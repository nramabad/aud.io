import Busboy from 'busboy';
import http from 'http';
import https from 'https';
import prism from 'prism-media';
import { Readable } from 'stream';
import crypto from 'crypto';
import logger from 'loglevel';
import { createGzip, createGunzip } from 'zlib';
import {
  getFFmpegArgs, getS3, logError, noInputError,
} from './utilities';

const Bucket = 'mpeg-cache';
const protocols = { http, https };

/**
 * computeNewFile handles FFmpeg conversion and uploading to S3 cache
 * @param {} bufs - in-memory cached buffer chunks of input file stream
 * @param {*} args - ffmpeg arguments
 * @param {*} s3obj - default s3 configurations / arguments
 * @param {*} isPresign - boolean to return a presigned S3 URL or file binary itself
 * @param {*} res - response object / stream
 */
const computeNewFile = (bufs, args, s3obj, isPresign, res) => () => {
  const cachedFile = new Readable({ read: () => {} });
  const processed = cachedFile.pipe(new prism.FFmpeg({ args }));

  processed.on('error', logError);
  getS3().upload(
    { ...s3obj, Body: processed.pipe(createGzip()) },
    (ex) => {
      if (ex) logError(ex);
      else {
        logger.info('Uploaded to S3 Cache Successful');
        if (isPresign) {
          getS3().getSignedUrl(
            'getObject',
            s3obj,
            (err, url) => (url
              ? res.status(200).json({ url })
              : logError(err)),
          );
        }
      }
    },
  );

  processed.pipe(res);

  while (bufs.length) cachedFile.push(bufs.shift());
  cachedFile.push(null);
};

/**
 * processFile assists in all logic to stream file from input, return cached value if present
 * perform normalization if not present, insert into cache & return valid output
 * @param {} args - ffmpeg arguments
 * @param {*} filetype - mp3, wav, etc.
 * @param {*} isPresign - fetch a presigned url or pipe file binary directly
 * @param {*} res - response object
 * @param {*} fileStream - file stream (optional)
 */
const processFile = (res, { file: fileStream, cb }) => {
  if (!res.locals) res.locals = {};
  res.locals.shasum = crypto.createHash('sha256');

  const processFileHelper = (file) => {
    res.locals.bufs = [];

    file.on('error', logError);
    file.on('data', (data) => {
      /*  TODO: If audio files will be large (ex. podcasts, voice memos, etc.),
            add logic to write chunks to local file(s).  */
      res.locals.bufs.push(data);
      res.locals.shasum.update(data);
    });
    file.on('end', cb);
  };

  return fileStream ? processFileHelper(fileStream) : processFileHelper;
};

const sendResponse = (body, res) => {
  if (!res.locals) res.locals = {};
  res.locals.ffmpegArgs = getFFmpegArgs(body);

  const { bufs, ffmpegArgs, shasum } = res.locals;
  if (!bufs) {
    if (!Array.isArray(ffmpegArgs) || ffmpegArgs.length < 4) {
      return noInputError(res);
    }
    const url = ffmpegArgs.pop();
    return protocols[url.split(':').shift()].get(url, processFile(res, {
      cb: () => sendResponse(body, res),
    }));
  }
  const [args, filetype, isPresign] = ffmpegArgs;

  const Key = `mpeg${[...args].sort().join('')}${shasum.digest('hex')}.${filetype}.gz`;
  const s3obj = { Key, Bucket };

  if (isPresign) {
    getS3().getSignedUrl(
      'getObject',
      s3obj,
      (_, url) => (url
        ? res.status(200).json({ url })
        : computeNewFile(bufs, args, s3obj, res)),
    );
  } else {
    const readFromCache = getS3()
      .getObject(s3obj)
      .createReadStream();

    readFromCache.on('error', computeNewFile(bufs, args, s3obj, isPresign, res));
    readFromCache.on('end', () => logger.info('Download from S3 Successful'));

    readFromCache.pipe(createGunzip()).pipe(res);
  }
};

/**
 * controller to handle logic to normalize audio files
 * @param {} req - request stream/object
 * @param {*} res - response stream/object
 */
const controller = (req, res) => {
  const { method, headers } = req;

  const params = new URLSearchParams(req.url.split('/').pop()).entries();
  const body = {};

  for (const [key, val] of params) body[key] = val;

  if (method === 'GET') sendResponse(body, res);
  else if (method === 'POST') {
    const busboy = new Busboy({ headers });

    busboy.on('field', (key, val) => {
      body[key] = val;
    });
    busboy.on('file', (_, file) => processFile(res, { file }));
    busboy.on('error', logError);
    busboy.on('finish', () => {
      logger.info('Parsing Complete');
      sendResponse(body, res);
    });
    req.pipe(busboy);
  } else {
    logger.error('Unsupported Method');
    res.writeHead(405, { Error: 'Unsupported Method' }).end();
  }
};

export default controller;
