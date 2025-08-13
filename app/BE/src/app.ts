import express, { type Application } from 'express';
import { json } from './middleware/json';
import { cors } from './middleware/cors';
import { errorHandler } from './middleware/error';
import { buildRouter } from './router';
import { jwtOptional } from './shared/auth/jwt';
import { requestId } from './middleware/request-id';

export function createApp(): Application {
  const app = express();

  // middleware
  app.use(requestId());
  app.use(cors());
  app.use(json());
  app.use(jwtOptional());

  // routes
  app.use('/api', buildRouter());

  // error handler
  app.use(errorHandler);

  return app;
}


