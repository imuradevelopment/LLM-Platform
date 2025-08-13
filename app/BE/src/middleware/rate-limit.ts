import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

function now() { return Date.now(); }

export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string }) {
  const buckets = new Map<string, Bucket>();
  const windowMs = Math.max(1000, Math.floor(opts.windowMs));
  const max = Math.max(1, Math.floor(opts.max));
  const keyFn = opts.key || ((req) => String((req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown'));

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const ts = now();
    const b = buckets.get(key) || { tokens: 0, updatedAt: ts };
    if (ts - b.updatedAt > windowMs) {
      b.tokens = 0;
      b.updatedAt = ts;
    }
    b.tokens += 1;
    buckets.set(key, b);
    if (b.tokens > max) {
      res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
      return;
    }
    next();
  };
}


