# aud.io

GET https://aud-i0.herokuapp.com

Send a download URL and stream out to an output file
```
curl https://aud-i0.herokuapp.com/?url=https%3A%2F%2Fwww.bensound.com%2Fbensound-music%2Fbensound-ukulele.mp3 >> output6.mp3
```

Returns a presigned URL to download the gzipped audio file

POST https://aud-i0.herokuapp.com

Stream an input file and stream out to an output file
```
curl -X POST -H "Content-Type: multipart/form-data" -F "file=@./audio.mp3" -F "type=audio/mpeg" https://aud-i0.herokuapp.com >> normalized_audio.mp3
```