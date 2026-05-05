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
  source_timezone: z.string().nullable().optional(),
  source_timezone_label: z.string().nullable().optional(),
  time_display_mode: z.enum(['visitor', 'source']).nullable().optional(),
  import_review_state: z.string().nullable().optional(),
  source_metadata: z.unknown().nullable().optional(),
  created_by: z.number().nullable(),
  created_at: z.string(),
});

export const EventRegistrationOptionSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  position: z.number(),
  label: z.string(),
  description: z.string().nullable(),
  price_amount: z.union([z.number(), z.string()]).nullable(),
  currency: z.string().nullable(),
  raw_price_label: z.string().nullable(),
  guest_policy: z.string().nullable(),
  capacity: z.number().nullable(),
  spaces_left: z.number().nullable(),
  availability_status: z.enum(['available', 'waitlist', 'full', 'closed', 'unknown']),
  cancellation_note: z.string().nullable(),
  source_registration_url: z.string().nullable(),
  review_state: z.enum(['needs_review', 'reviewed', 'ignored']),
  is_disabled: z.boolean(),
  raw_source_metadata: z.unknown().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const EventRSVPSchema = z.object({
  id: z.number(),
  event_id: z.number(),
  member_id: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
});

export type Event = z.infer<typeof EventSchema>;
export type EventRegistrationOption = z.infer<typeof EventRegistrationOptionSchema>;
export type EventRSVP = z.infer<typeof EventRSVPSchema>;
