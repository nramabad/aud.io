import AWS from 'aws-sdk';
import logger from 'loglevel';

let s3;

/**
 * gets current s3 instance or creates a new instance
 */
export const getS3 = () => {
  if (!s3) s3 = new AWS.S3();
  return s3;
};

/**
 * The following acronyms should be familiar to you if you're familiar with the ffmpeg CLI options.
 * If not, I've included some plain English alternatives for readability.
 * @param {*} param0
 */
export const getFFmpegArgs = ({
  input, inputUrl, url,
  I, integratedLoudness,
  TP, truePeak,
  LRA, loudnessRange,
  bitRate,
  f, format,
  ...opts
}) => {
  if (!opts.af) {
    const i = I ?? integratedLoudness ?? -14;
    const tp = TP ?? truePeak ?? -3;
    const lra = LRA ?? loudnessRange ?? 11;
    opts.af = `loudnorm=I=${i}:TP=${tp}:LRA=${lra}:print_format=json`;
  }
  if (bitRate && !opts['b:a']) opts['b:a'] = bitRate;
  opts.f = f ?? format ?? 'mp3';

  const options = new Set();
  Object.entries(opts).forEach(([key, val]) => {
    options.add(`-${key}`);
    options.add(val);
  });

  let downloadUrl = input ?? inputUrl ?? url;
  if (downloadUrl) downloadUrl = decodeURIComponent(downloadUrl);
  return [Array.from(options), opts.f, downloadUrl];
};

/**
 * reusable error logger
 * @param {} error - error object or string
 */
export const logError = (error) => logger.error(typeof error === 'object' && error.message ? error.message : error);
