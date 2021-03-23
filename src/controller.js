import Busboy from 'busboy';
import http from 'http';
import https from 'https';
import prism from 'prism-media';
import { Readable } from 'stream';
import crypto from 'crypto';
import logger from 'loglevel';
import { createGzip, createGunzip } from 'zlib';
import {
  getFFmpegArgs, getS3, logError, noInputError, jsonRes,
} from './utilities';

const Bucket = 'mpeg-cache';
const protocols = { http, https };

/**
 * computeNewFile handles FFmpeg conversion and uploading to S3 cache
 * @param {*} res - response object / stream
 * @param {*} s3obj - default s3 configurations / arguments
 */
const computeNewFile = (res, s3obj) => {
  const { bufs, ffmpegArgs: [args,, isPresign] } = res.locals;

  const computeNewFileHelper = () => {
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
              (err, url) => (err
                ? logError(err)
                : jsonRes(res, url)),
            );
          }
        }
      },
    );

    if (!isPresign) processed.pipe(res);

    while (bufs.length) cachedFile.push(bufs.shift());
    cachedFile.push(null);
  };

  return isPresign ? computeNewFileHelper() : computeNewFileHelper;
};

/**
 * processFile assists in all logic to stream file from input, return cached value if present
 * perform normalization if not present, insert into cache & return valid output
 * @param {*} res - response object
 * @param {*} fileStream - file stream (optional)
 * @param {*} cb - optional callback to execute on file processing end
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
    if (cb) file.on('end', cb);
  };

  return fileStream ? processFileHelper(fileStream) : processFileHelper;
};

/**
 * sendResponse handles all logic to take body/params and send a response
 * @param {*} body - params / query / body args
 * @param {*} res - node.js response object / stream
 */
const sendResponse = (body, res) => {
  if (!res.locals) res.locals = {};
  res.locals.ffmpegArgs = getFFmpegArgs(body);

  const { bufs, ffmpegArgs, shasum } = res.locals;
  if (!bufs) {
    if (!Array.isArray(ffmpegArgs)) return noInputError(res);
    const url = ffmpegArgs.pop();
    if (!url) return noInputError(res);

    return protocols[url.split(':').shift()].get(url, processFile(res, {
      cb: () => sendResponse(body, res),
    }));
  }
  const [args, filetype, isPresign] = ffmpegArgs;

  const Key = `mpeg${[...args].sort().join('')}${shasum.digest('hex')}.${filetype}.gz`;
  const s3obj = { Key, Bucket };

  if (isPresign) {
    return getS3().headObject(s3obj, (err) => (err && err.code === 'NotFound'
      ? computeNewFile(res, s3obj)
      : getS3().getSignedUrl('getObject', s3obj, (ex, url) => (ex
        ? logError(ex)
        : jsonRes(res, url)))));
  }
  const readFromCache = getS3()
    .getObject(s3obj)
    .createReadStream();

  readFromCache.on('error', computeNewFile(res, s3obj));
  readFromCache.on('end', () => logger.info('Download from S3 Successful'));

  readFromCache.pipe(createGunzip()).pipe(res);
};

/**
 * controller to handle logic to normalize audio files
 * @param {} req - request stream/object
 * @param {*} res - response stream/object
 */
const controller = (req, res) => {
  const { method, headers, url } = req;
  if (url.includes('robots.txt') || url.includes('favicon.ico')) {
    return res.end('User-agent: *\nDisallow: /');
  }

  const params = new URLSearchParams(url.split('/').pop()).entries();
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
