import Busboy from 'busboy';
import http from 'http';
import prism from 'prism-media';
import { Readable } from 'stream';
import crypto from 'crypto';
import logger from 'loglevel';
import { createGzip, createGunzip } from 'zlib';
import { getFFmpegArgs, getS3, logError } from './utilities';

const Bucket = 'mpeg-cache';

/**
 * processFile assists in all logic to stream file from input, return cached value if present
 * perform normalization if not present, insert into cache & return valid output
 * @param {} args - ffmpeg arguments
 * @param {*} filetype - mp3, wav, etc.
 * @param {*} isPresign - fetch a presigned url or pipe file binary directly
 * @param {*} res - response object
 * @param {*} fileStream - file stream (optional)
 */
const processFile = (args, filetype, isPresign, res, fileStream) => {
  const shasum = crypto.createHash('sha256');

  const processFileHelper = (file) => {
    const bufs = [];

    file.on('error', logError);
    file.on('data', (data) => {
      /*  TODO: If audio files will be large (ex. podcasts, voice memos, etc.),
            add logic to write chunks to local file(s).  */
      bufs.push(data);
      shasum.update(data);
    });
    file.on('end', () => {
      const Key = `mpeg${[...args].sort().join('')}${shasum.digest('hex')}.${filetype}.gz`;

      // TODO: logic for presigned url
      const readFromCache = getS3()
        .getObject({ Bucket, Key })
        .createReadStream();

      readFromCache.on('error', () => {
        const cachedFile = new Readable({ read: () => {} });
        const processed = cachedFile.pipe(new prism.FFmpeg({ args }));

        processed.on('error', logError);
        getS3().upload(
          { Bucket, Body: processed.pipe(createGzip()), Key },
          (ex) => (ex ? logError(ex) : logger.info('Uploaded to S3 Cache Successful')),
        );
        processed.pipe(res);

        while (bufs.length) cachedFile.push(bufs.shift());
        cachedFile.push(null);
      });
      readFromCache.on('end', () => logger.info('Download from S3 Successful'));

      readFromCache.pipe(createGunzip()).pipe(res);
    });
  };

  return fileStream ? processFileHelper(fileStream) : processFileHelper;
};

/**
 * controller to handle logic to normalize audio files
 * @param {} req - request stream/object
 * @param {*} res - response stream/object
 */
const controller = (req, res) => {
  const {
    method, headers, query = {}, body = {}, params = {},
  } = req;

  if (method !== 'GET' && method !== 'POST') {
    logger.error('Unsupported Method');
    res.writeHead(405, { Error: 'Unsupported Method' }).end();
  } else {
    const [args, filetype, inputUrl] = getFFmpegArgs({ ...params, ...query, ...body });
    const isPresignedUrl = method === 'GET';

    if (inputUrl) http.get(inputUrl, processFile(args, filetype, isPresignedUrl, res));
    else {
      const busboy = new Busboy({ headers });

      busboy.on('file', (_, file) => processFile(args, filetype, isPresignedUrl, res, file));
      busboy.on('error', logError);
      busboy.on('finish', () => logger.info('Parsing Complete'));
      req.pipe(busboy);
    }
  }
};

export default controller;
