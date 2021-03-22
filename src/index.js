const http = require('http');
const { inspect } = require('util');
const Busboy = require('busboy');
const prism = require('prism-media');
const { createGzip, createGunzip} = require('zlib');
const AWS = require('aws-sdk');


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-west-1'
});

let gzip, gunzip, s3;
const Bucket = 'mpeg-cache';

exports.handler = function({ payload = {}, headers }, context, callback) {
    const {
      I, integratedLoudness, TP, truePeak, LRA, loudnessRange, f, format, ...opts
    } = payload; // TODO: rm query if security is paramount

    if (!opts.af) {
        const i = I ?? integratedLoudness ?? -14;
        const tp = TP ?? truePeak ?? -3;
        const lra = LRA ?? loudnessRange ?? 11;
        opts.af = `loudnorm=I=${i}:TP=${tp}:LRA=${lra}:print_format=json`;
    }
    opts.f = f ?? format ?? 'mp3';

    const options = new Set();
    Object.entries(opts).forEach(([key, val]) => {
        options.add(`-${key}`);
        options.add(val);
    }) ;
    const args = Array.from(options);
    const Key = `mpeg${[...args].sort().join('')}.${opts.f}.gz`;

    if (!s3) s3 = new AWS.S3();
    if (!gunzip) gunzip = createGunzip();

    const readFromCache = s3.getObject({ Bucket, Key }).createReadStream();

    readFromCache.on('error', () => {
        const ffmpeg = new prism.FFmpeg({ args });
        const busboy = new Busboy({ headers });
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            console.info(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
    
            file.on('data', (data) => console.info(`File [${fieldname}] got ${data.length} bytes`));
            file.on('end', () => console.info(`File [${fieldname}] Finished`));

            const processed = file.pipe(ffmpeg)

            if (!gzip) gzip = createGzip();
            if (!s3) s3 = new AWS.S3();
            s3.upload(
                { Bucket, Body: processed.pipe(gzip), Key }, 
                ex => ex ? console.error(ex) : console.info('Uploaded to S3 Cache Successful'),
            );
            processed.pipe(res);
        });

        busboy.on('finish', () => console.info('Done parsing!'));
        req.pipe(busboy);
    });
    
    readFromCache.pipe(gunzip).pipe(res);
}
