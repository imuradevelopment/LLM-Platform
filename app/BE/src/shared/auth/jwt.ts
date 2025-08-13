import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing required env: JWT_SECRET');
  return secret;
}

export function createJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' } as const;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 7; // 7 days
  const body = { ...payload, iat, exp };
  const enc = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${enc(header)}.${enc(body)}`;
  const sig = crypto.createHmac('sha256', getJwtSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt(token: string): any | null {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const data = `${h}.${b}`;
    const sig = crypto.createHmac('sha256', getJwtSecret()).update(data).digest('base64url');
    if (sig !== s) return null;
    const body = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (body.exp && Date.now() / 1000 > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

export function jwtOptional() {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts[0] === 'Bearer' && parts[1]) {
      const payload = verifyJwt(parts[1]);
      if (payload?.sub) {
        (res.locals as any).userId = Number(payload.sub);
      }
    }
    next();
  };
}

export function jwtRequired() {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    const payload = token ? verifyJwt(token) : null;
    if (!payload?.sub) return res.status(401).json({ error: 'Unauthorized' });
    (res.locals as any).userId = Number(payload.sub);
    next();
  };
}


