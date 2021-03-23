# aud.io

![Design Logic Diagram](https://user-images.githubusercontent.com/42252054/112203090-60980a00-8bcf-11eb-8dbd-6b6c8ff5e195.png)

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

### Input a download URL and stream out to an output file
```
curl -X POST -H "Content-Type: multipart/form-data" -F "url=https%3A%2F%2Fwww.bensound.com%2Fbensound-music%2Fbensound-slowmotion.mp3" >> normalized_audio.mp3
```

### Input a download URL and receive a JSON w/ a presigned URL to download from S3
```
curl -X POST -H "Content-Type: multipart/form-data" -F "url=https%3A%2F%2Fwww.bensound.com%2Fbensound-music%2Fbensound-slowmotion.mp3" -F "presignRes=true"
```
