import Busboy from 'busboy';
import prism from 'prism-media';
import { Readable } from 'stream';
import crypto from 'crypto';
import logger from 'loglevel';
import { createGzip, createGunzip } from 'zlib';
import { getFFmpegArgs, getS3, logError } from './utilities';

const Bucket = 'mpeg-cache';

/**
 * controller to handle logic to normalize audio files
 * @param {} req - request stream/object
 * @param {*} res - response stream/object
 */
const controller = (req, res) => {
  const {
    method, headers, query = {}, body = {},
  } = req;
  if (method === 'POST') {
    const [args, filetype] = getFFmpegArgs({ ...query, ...body });

    const busboy = new Busboy({ headers });
    const shasum = crypto.createHash('sha256');

    busboy.on('file', (_, file) => {
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
    });

    busboy.on('error', logError);
    busboy.on('finish', () => logger.info('Parsing Complete'));
    req.pipe(busboy);
  } else {
    logger.error('Unsupported Method');
    res.writeHead(405, { Error: 'Unsupported Method' }).end();
  }
};

export default controller;
