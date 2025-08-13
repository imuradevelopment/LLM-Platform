import corsLib from 'cors';

export function cors() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) throw new Error('Missing required env: CORS_ORIGIN');
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const allowAll = list.includes('*');
  return corsLib({
    origin: (origin, callback) => {
      if (allowAll) return callback(null, true);
      if (!origin) return callback(null, false);
      const ok = list.some((o) => origin === o);
      return callback(ok ? null : new Error('CORS blocked'), ok);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Chat-Id', 'Authorization', 'X-LLM-Provider', 'X-LLM-Model', 'X-Request-Id'],
    exposedHeaders: ['X-Chat-Id', 'X-Request-Id'],
  });
}


