import { z } from 'astro/zod';

export const ForumCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number(),
  color: z.string(),
});

export const ForumTopicSchema = z.object({
  id: z.number(),
  category_id: z.number().nullable(),
  title: z.string(),
  body: z.string(),
  author_id: z.number().nullable(),
  author_name: z.string().nullable(),
  is_pinned: z.boolean(),
  reply_count: z.number(),
  last_reply_at: z.string().nullable(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  created_at: z.string(),
});

export const ForumReplySchema = z.object({
  id: z.number(),
  topic_id: z.number(),
  body: z.string(),
  author_id: z.number().nullable(),
  author_name: z.string().nullable(),
  hidden: z.boolean().optional(),
  created_at: z.string(),
});

export type ForumCategory = z.infer<typeof ForumCategorySchema>;
export type ForumTopic = z.infer<typeof ForumTopicSchema>;
export type ForumReply = z.infer<typeof ForumReplySchema>;
