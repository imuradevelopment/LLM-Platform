import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // ログのみ出力し、本文は返さない（TODO記載の仕様）
  // eslint-disable-next-line no-console
  console.error(err);
  if (res.headersSent) return;
  res.status(500).end();
};


