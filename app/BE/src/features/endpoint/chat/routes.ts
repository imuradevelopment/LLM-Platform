import { Router, type Request, type Response } from 'express';
import { chatBodySchema } from './schema';
import { chatService } from './service';
import { jwtRequired } from '../../../shared/auth/jwt';
import { listChatsByUser, getMessagesByChat, renameChat, deleteChat } from './repository';
import { sendPlainStream } from '../../../shared/streaming/sendPlainStream';
import { debugLog, debugError, debugWarn } from '../../../shared/logger';
import { rateLimit } from '../../../middleware/rate-limit';

export function chatRouter() {
  const router = Router();

  // 軽いレート制限（1分あたり60リクエスト/クライアント）
  router.post('/', rateLimit({ windowMs: 60_000, max: 60 }), jwtRequired(), async (req: Request, res: Response) => {
    try {
      const userId: number | undefined = (res.locals as any)?.userId;
      const parse = chatBodySchema.safeParse(req.body);
      if (!parse.success) {
        debugWarn('POST /api/chat invalid body', { body: req.body });
        return res.status(400).json({ error: 'Invalid body' });
      }

      const chatIdParam = req.header('x-chat-id');
      const chatId = chatIdParam ? Number(chatIdParam) : undefined;
      debugLog('POST /api/chat start', {
        userId,
        chatIdHeader: chatIdParam ?? null,
        messages: parse.data.messages.length,
      });
      const abortController = new AbortController();
      const providerHeader = String(req.header('x-llm-provider') || '').trim();
      const modelHeader = String(req.header('x-llm-model') || '').trim();
      // provider/model を許可リスト検証
      try {
        const { isProviderAllowed, isModelAllowed } = await import('../../llm/allowed-models');
        if (providerHeader && !isProviderAllowed(providerHeader)) {
          return res.status(400).json({ error: 'Invalid provider' });
        }
        if (providerHeader && modelHeader && !isModelAllowed(providerHeader, modelHeader)) {
          return res.status(400).json({ error: 'Invalid model' });
        }
      } catch {}
      const providerValue: 'gemini' | 'azure-openai' | 'openai' | undefined =
        providerHeader === 'gemini' || providerHeader === 'azure-openai' || providerHeader === 'openai'
          ? (providerHeader as 'gemini' | 'azure-openai' | 'openai')
          : undefined;
      const { readable, chatId: effectiveChatId } = await chatService(
        parse.data,
        chatId,
        userId,
        abortController.signal,
        providerValue,
        modelHeader || undefined
      );
      res.setHeader('X-Chat-Id', String(effectiveChatId));
      debugLog('POST /api/chat streaming begin', { effectiveChatId });
      sendPlainStream(req, res, readable, () => abortController.abort());
    } catch (error) {
      const code = (error as any)?.code || '';
      const msg = String((error as any)?.message || '');
      // known validation/auth
      if (code === 'USER_NOT_FOUND') {
        debugWarn('POST /api/chat user not found');
        return res.status(401).json({ error: 'Invalid user (please login again)' });
      }
      if (code === 'INVALID_LAST_MESSAGE') {
        debugWarn('POST /api/chat last message must be user');
        return res.status(400).json({ error: 'Invalid body: last message must be user' });
      }
      // rate limit like
      if (/rate/i.test(msg)) {
        debugWarn('POST /api/chat rate limited');
        return res.status(429).json({ error: 'Rate limited. Please retry after a short wait.' });
      }
      // context length like
      if (/context|token|length|Too Long/i.test(msg)) {
        debugWarn('POST /api/chat context length exceeded');
        return res.status(413).json({ error: 'Input too large. Please shorten the conversation.' });
      }
      // eslint-disable-next-line no-console
      console.error(error);
      debugError('POST /api/chat failed', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // GET /api/chat/chats - list chats for current user
  router.get('/chats', jwtRequired(), async (_req: Request, res: Response) => {
    try {
      const userId: number | undefined = (res.locals as any)?.userId;
      debugLog('GET /api/chat/chats', { userId });
      const chats = await listChatsByUser(userId!);
      return res.json({ chats });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      debugError('GET /api/chat/chats failed', error);
      return res.status(500).end();
    }
  });

  // GET /api/chat/:id/messages - list messages for a chat (owner)
  router.get('/:id/messages', jwtRequired(), async (req: Request, res: Response) => {
    try {
      const userId: number | undefined = (res.locals as any)?.userId;
      const chatId = Number(req.params.id);
       debugLog('GET /api/chat/:id/messages', { userId, chatId });
      const messages = await getMessagesByChat(chatId, userId!);
      // 空でも 200 で空配列を返す（UX 一貫性のため）
      return res.json({ messages });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      debugError('GET /api/chat/:id/messages failed', error);
      return res.status(500).end();
    }
  });

  // PATCH /api/chat/:id - rename chat (owner)
  router.patch('/:id', jwtRequired(), async (req: Request, res: Response) => {
    try {
      const userId: number | undefined = (res.locals as any)?.userId;
      const chatId = Number(req.params.id);
      const title = String((req.body?.title ?? '') as string);
      if (!title) return res.status(400).json({ error: 'title is required' });
      debugLog('PATCH /api/chat/:id', { userId, chatId, title });
      const ok = await renameChat(chatId, userId!, title);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      debugError('PATCH /api/chat/:id failed', error);
      return res.status(500).end();
    }
  });

  // DELETE /api/chat/:id - delete chat and its messages (owner)
  router.delete('/:id', jwtRequired(), async (req: Request, res: Response) => {
    try {
      const userId: number | undefined = (res.locals as any)?.userId;
      const chatId = Number(req.params.id);
      debugLog('DELETE /api/chat/:id', { userId, chatId });
      const ok = await deleteChat(chatId, userId!);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      debugError('DELETE /api/chat/:id failed', error);
      return res.status(500).end();
    }
  });

  return router;
}


