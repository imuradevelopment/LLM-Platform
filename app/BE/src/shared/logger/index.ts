type LogLevel = 'debug' | 'warn' | 'error' | 'silent';

function currentLevel(): LogLevel {
  const raw = (process.env.CHAT_LOG_LEVEL || '').toLowerCase();
  if (raw === 'silent' || raw === 'off') return 'silent';
  if (raw === 'error') return 'error';
  if (raw === 'warn' || raw === 'warning') return 'warn';
  return 'debug';
}

function allow(level: LogLevel): boolean {
  const order: Record<LogLevel, number> = { debug: 1, warn: 2, error: 3, silent: 4 };
  return order[level] >= order[currentLevel()];
}

export function debugLog(...args: unknown[]): void {
  if (!allow('debug')) return;
  // eslint-disable-next-line no-console
  console.log('[CHAT]', ...args);
}

export function debugWarn(...args: unknown[]): void {
  if (!allow('warn')) return;
  // eslint-disable-next-line no-console
  console.warn('[CHAT]', ...args);
}

export function debugError(...args: unknown[]): void {
  if (!allow('error')) return;
  // eslint-disable-next-line no-console
  console.error('[CHAT]', ...args);
}


