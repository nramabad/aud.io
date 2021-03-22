import http from 'http';
import AWS from 'aws-sdk';
import logger from 'loglevel';
import controller from './controller';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-west-1',
});

const PORT = process.env.PORT ?? 3000;

http.createServer(controller)
  .listen(PORT, () => logger.info('Listening on port ', PORT));
