const http = require('http');
const { inspect } = require('util');
const Busboy = require('busboy');
const prism = require('prism-media');

http.createServer((req, res) => {
  const {
    method, headers, query = {}, body = {}, params = {},
  } = req;
  if (method === 'POST') {
    const {
      I, integratedLoudness, TP, truePeak, LRA, loudnessRange, f, format,
    } = { ...query, ...body, ...params };

    const i = I ?? integratedLoudness ?? -14;
    const tp = TP ?? truePeak ?? -3;
    const lra = LRA ?? loudnessRange ?? 11;

    const ffmpeg = new prism.FFmpeg({
      args: [
        '-af', `loudnorm=I=-${i}:TP=${tp}:LRA=${lra}:print_format=json`,
        '-f', f ?? format ?? 's16le',
      ],
    });
    const busboy = new Busboy({ headers });
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.log(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);
      
      file.on('data', (data) => {
        console.log(`File [${fieldname}] got ${data.length} bytes`);
      });
      file.on('end', () => {
        console.log(`File [${fieldname}] Finished`);
      });

      file.pipe(ffmpeg).pipe(res);
    });
    busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      console.log(`Field [${fieldname}]: value: ${inspect(val)}`);
    });
    busboy.on('finish', () => {
      console.log('Done parsing form!');
      res.writeHead(303, { Connection: 'close', Location: '/' }).end();
    });
    req.pipe(busboy);
  } else res.writeHead(405, { Error: 'Unsupported Method' }).end();
});
