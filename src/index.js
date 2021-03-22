const http = require('http');
const { inspect } = require('util');
const Busboy = require('busboy');
const prism = require('prism-media');
const { createGzip, createGunzip} = require('zlib');
const AWS = require('aws-sdk');
const { Readable } = require('stream');
const crypto = require('crypto');


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-west-1'
});

let gzip, gunzip, s3;
const PORT = process.env.PORT ?? 3000;
const Bucket = 'mpeg-cache';

http.createServer((req, res) => {
  const { method, headers, query = {}, body = {} } = req;
  if (method === 'POST') {
    const {
      I, integratedLoudness, TP, truePeak, LRA, loudnessRange, f, format, ...opts
    } = { ...query, ...body }; // TODO: rm query if security is paramount

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

    const busboy = new Busboy({ headers });
    const shasum = crypto.createHash('sha256');

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.info(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
        const bufs = [];

        file.on('data', (data) => {
            bufs.push(data);
            shasum.update(data)
        });
        file.on('end', () => {
            console.info(`File [${fieldname}] Finished`)

            const Key = `mpeg${[...args].sort().join('')}${shasum.digest('hex')}.${opts.f}.gz`;

            if (!s3) s3 = new AWS.S3();
            if (!gunzip) gunzip = createGunzip();
            console.log(Key)

            const readFromCache = s3.getObject({ Bucket, Key }).createReadStream();

            readFromCache.on('error', () => {
                const cachedFile = new Readable();
                cachedFile._read = () => {};
                const processed = cachedFile.pipe(new prism.FFmpeg({ args }));

                if (!gzip) gzip = createGzip();
                if (!s3) s3 = new AWS.S3();
                s3.upload(
                    { Bucket, Body: processed.pipe(gzip), Key }, 
                    ex => ex ? console.error(ex) : console.info('Uploaded to S3 Cache Successful'),
                );
                processed.pipe(res);

                while (bufs.length) cachedFile.push(bufs.shift());
                cachedFile.push(null);
            });
            readFromCache.on('end', () => console.log('Downloaded from S3 Successful!'))

            readFromCache.pipe(gunzip).pipe(res);
        });
    });

    busboy.on('finish', () => console.info('Done parsing!'));
    req.pipe(busboy);
  } else res.writeHead(405, { Error: 'Unsupported Method' }).end();
}).listen(PORT, () => console.info('Listening on port ', PORT));
