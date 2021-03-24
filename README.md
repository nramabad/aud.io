# aud.io

**_Run FFmpeg jobs on demand with aud.io!_** This project implements a plain Node.JS HTTP server hosted on Heroku Dynos. It accepts audio media in the form of download links or file streamed POSTed as a part of multipart form data (making it a convenient plugin API for frontend and backends alike). Response can be accepted as a JSON with a download URL or a file stream. Download URLs are provided courtesy a presigned AWS S3 file URL with default expiration. All requests are GZIP compressed and cached in S3, and all download URLs responses are GZIP compressed. The minimal NPM dependencies allows this project to be fast and relatively portable.

## Design Logic Diagram

![Design Logic Diagram](https://user-images.githubusercontent.com/42252054/112205930-97bbea80-8bd2-11eb-9417-38c2da56432c.png)
## GET https://aud-i0.herokuapp.com

### Input a download URL and stream out to an output file
```
curl https://aud-i0.herokuapp.com/?url=https%3A%2F%2Fwww.bensound.com%2Fbensound-music%2Fbensound-ukulele.mp3 >> normalized_audio.mp3
```

### Input a download URL and receive a JSON w/ a presigned URL to download from S3
```
curl -X GET 'https://aud-i0.herokuapp.com/?url=https%3A%2F%2Fwww.bensound.com%2Fbensound-music%2Fbensound-slowmotion.mp3&presignRes=true'
```

## POST https://aud-i0.herokuapp.com

### Stream an input file and stream out to an output file
```
curl -X POST -H "Content-Type: multipart/form-data" -F "file=@./audio.mp3" -F "type=audio/mpeg" https://aud-i0.herokuapp.com >> normalized_audio.mp3
```

### Stream an input file and receive a JSON w/ a presigned URL to download from S3
```
curl -X POST -H "Content-Type: multipart/form-data" -F "file=@./audio.mp3" -F "type=audio/mpeg" -F "presignRes=true" https://aud-i0.herokuapp.com
```

### Input a download URL and stream out to an output file
```
curl -X POST -H "Content-Type: multipart/form-data" -F "url=https://www.bensound.com/bensound-music/bensound-hey.mp3" https://aud-i0.herokuapp.com >> normalized_audio.mp3
```

### Input a download URL and receive a JSON w/ a presigned URL to download from S3
```
curl -X POST -H "Content-Type: multipart/form-data" -F "url=https://www.bensound.com/bensound-music/bensound-hey.mp3" -F "presignRes=true" https://aud-i0.herokuapp.com
```
## Options / Arguments

All arguments accepted via query, params or body data. The following FFmpeg options are supported explicitly with equivalent plain-text key names:  
  
`input`/`inputUrl`/`url` - Input download URL for audio file (REQUIRED if no file streamed as form POST data)  
`I`/`integratedLoudness` - Integrated Loudness (default: -14)  
`TP`/`truePeak` - Inter sample peak (default: -3)  
`LRA`/`loudnessRange` - Loudness Range from softest to loudest (default: 11)  
`bitRate` - Audio Bit Rate (bits per unit time) (optional)  
`presignRes`/`presignResponse` - returns pre-signed S3 download URL if equal to true (default: false - streams file to response)

Other options supported by FFmpeg are implicitly supported by their key name as documented here: https://ffmpeg.org/ffmpeg.html#Generic-options

## Technologies

_Node.JS (HTTP/HTTPS, crypto, stream, zlib), Heroku, AWS S3, FFmpeg_

## Dependencies

_aws-sdk, busboy, @discordjs/opus, ffmpeg-static, loglevel, prism-media_
