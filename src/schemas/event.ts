import { z } from 'astro/zod';

export const EventSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  capacity: z.number().nullable(),
  image_url: z.string().nullable(),
  is_members_only: z.boolean(),
  created_by: z.number().nullable(),
  created_at: z.string(),
});

export const EventRSVPSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  member_id: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
});

export type Event = z.infer<typeof EventSchema>;
export type EventRSVP = z.infer<typeof EventRSVPSchema>;
