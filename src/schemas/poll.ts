import { z } from 'astro/zod';

export const PollSchema = z.object({
  id: z.number(),
  question: z.string(),
  description: z.string().nullable(),
  poll_type: z.enum(['single', 'multiple']),
  is_anonymous: z.boolean(),
  results_visible: z.enum(['always', 'after_vote', 'after_close']),
  is_open: z.boolean(),
  closes_at: z.string().nullable(),
  attached_to: z.string().nullable(),
  attached_id: z.number().nullable(),
  created_by: z.number().nullable(),
  created_at: z.string(),
});

export const PollOptionSchema = z.object({
  id: z.number(),
  poll_id: z.number(),
  label: z.string(),
  position: z.number(),
});

export const PollVoteSchema = z.object({
  id: z.number(),
  poll_id: z.number(),
  option_id: z.number(),
  member_id: z.number().nullable(),
  created_at: z.string(),
});

export type Poll = z.infer<typeof PollSchema>;
export type PollOption = z.infer<typeof PollOptionSchema>;
export type PollVote = z.infer<typeof PollVoteSchema>;
