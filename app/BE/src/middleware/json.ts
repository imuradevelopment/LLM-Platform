import express from 'express';

export function json() {
  // 2MB まで（必要に応じて調整）
  return express.json({ limit: '2mb' });
}


