import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

export function requestId() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const id = crypto.randomUUID();
    (res.locals as any).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}


