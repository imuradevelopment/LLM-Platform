import { z } from 'zod';

export const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const chatBodySchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export type ChatBody = z.infer<typeof chatBodySchema>;


