const http = require('http');
const { inspect } = require('util');
const Busboy = require('busboy');
const prism = require('prism-media');
const fs = require('fs');
const path = require('path');


const PORT = process.env.PORT ?? 3000;

http.createServer((req, res) => {
  const {
    method, headers, query = {}, body = {}, params = {},
  } = req;
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

    const args = new Set();
    Object.entries(opts).forEach(([key, val]) => {
        args.add(`-${key}`);
        args.add(val);
    }) ;

    const ffmpeg = new prism.FFmpeg({ args: Array.from(args) });
    const busboy = new Busboy({ headers });
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.info(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
      
      file.on('data', (data) => console.info(`File [${fieldname}] got ${data.length} bytes`));
      file.on('end', () => console.info(`File [${fieldname}] Finished`));

      file.pipe(ffmpeg).pipe(res);
    });

    busboy.on('finish', () => console.info('Done parsing!'));
    req.pipe(busboy);
  } else res.writeHead(405, { Error: 'Unsupported Method' }).end();
}).listen(PORT, () => console.info('Listening on port ', PORT));
