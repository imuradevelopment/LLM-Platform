import { Router, type Request, type Response } from 'express';
import { chatRouter } from './features/endpoint/chat/routes';
import { authRouter, authJwtRouter } from './features/endpoint/auth/routes';
import { llmRouter } from './features/endpoint/llm/routes';
import { rateLimit } from './middleware/rate-limit';

export function buildRouter() {
  const router = Router();

  // healthz
  router.get('/healthz', async (_req: Request, res: Response) => {
    try {
      return res.json({ ok: true, ts: Date.now() });
    } catch {
      return res.status(500).json({ ok: false });
    }
  });

  router.use('/chat', chatRouter());
  // auth 系への簡易レート制限
  router.use('/auth', rateLimit({ windowMs: 60_000, max: 30 }));
  router.use('/auth', authRouter());
  router.use('/auth', authJwtRouter());
  // chat POST へのピンポイント制限は各routes内で適用予定
  router.use('/llm', llmRouter());

  return router;
}


