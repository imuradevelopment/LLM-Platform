import { Router, type Request, type Response } from 'express';
import { getPgPool } from '../../../shared/database/postgres';
import crypto from 'node:crypto';
import { z } from 'zod';
import { createJwt, verifyJwt } from '../../../shared/auth/jwt';

export function authRouter() {
  const router = Router();

  router.get('/whoami', (req: Request, res: Response) => {
    const userId: number | null = (res.locals as any)?.userId ?? null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ userId });
  });

  return router;
}

// Helper: password hashing (PBKDF2)
function hashPassword(password: string, salt?: string) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const iterations = 200000;
  const algo = 'sha256';
  const hash = crypto.pbkdf2Sync(password, usedSalt, iterations, 32, algo).toString('hex');
  return { salt: usedSalt, hash, iterations, algo };
}

function verifyPassword(password: string, stored: string): boolean {
  // 新: pbkdf2:sha256:200000$salt$hash
  if (stored.startsWith('pbkdf2:')) {
    try {
      const [head, salt, hash] = stored.split('$');
      const parts = head.split(':');
      const iterStr = parts[2] || '200000';
      const algo = parts[1] || 'sha256';
      const iterations = Number(iterStr);
      const calc = crypto.pbkdf2Sync(password, salt, iterations, 32, algo as any).toString('hex');
      return calc === hash;
    } catch {
      return false;
    }
  }
  // 旧: pbkdf2$salt$hash
  const [method, salt, hash] = stored.split('$');
  if (method !== 'pbkdf2') return false;
  const verify = hashPassword(password, salt);
  return verify.hash === hash;
}

export function authJwtRouter() {
  const router = Router();
  const pool = getPgPool();
  const credSchema = z.object({ name: z.string().min(1).max(64), password: z.string().min(6).max(200) });

  // POST /api/auth/register { name, password }
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const parsed = credSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
      const name = parsed.data.name.trim();
      const password = parsed.data.password;

      const { salt, hash, iterations, algo } = hashPassword(password);
      const passwordHash = `pbkdf2:${algo}:${iterations}$${salt}$${hash}`;
      // 既存ユーザーのパスワードは上書きせず、409 を返す
      const inserted = await pool.query(
        'INSERT INTO users (name, password_hash) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id',
        [name, passwordHash]
      );
      if (!inserted.rows[0]?.id) {
        return res.status(409).json({ error: 'USER_EXISTS' });
      }
      const userId = Number(inserted.rows[0]?.id);
      return res.json({ userId });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      return res.status(500).end();
    }
  });

  // POST /api/auth/login { name, password } -> { token }
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const parsed = credSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
      const name = parsed.data.name.trim();
      const password = parsed.data.password;
      const user = await pool.query('SELECT id, password_hash FROM users WHERE name = $1 LIMIT 1', [name]);
      const record = user.rows[0];
      if (!record?.password_hash) return res.status(401).json({ error: 'invalid credentials' });
      const ok = verifyPassword(password, String(record.password_hash));
      if (!ok) return res.status(401).json({ error: 'invalid credentials' });

      const token = createJwt({ sub: String(record.id) });
      return res.json({ token });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      return res.status(500).end();
    }
  });

  // GET /api/auth/profile (JWT required)
  router.get('/profile', (req: Request, res: Response) => {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    const payload = verifyJwt(token || '');
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ userId: Number(payload.sub) || null });
  });

  return router;
}


