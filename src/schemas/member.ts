import { z } from 'astro/zod';

export const MemberTierSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  benefits: z.array(z.string()).nullable(),
  price_label: z.string().nullable(),
  position: z.number(),
  is_default: z.boolean(),
});

export const MemberCustomFieldSchema = z.object({
  id: z.number(),
  field_name: z.string(),
  field_label: z.string(),
  field_type: z.string(),
  options: z.any().nullable(),
  required: z.boolean(),
  visible_in_directory: z.boolean(),
  position: z.number(),
});

export const MemberSchema = z.object({
  id: z.number(),
  user_id: z.string().nullable(),
  email: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  tier_id: z.number().nullable(),
  role: z.string(),
  status: z.string(),
  custom_fields: z.record(z.any()).nullable(),
  joined_at: z.string(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MemberTier = z.infer<typeof MemberTierSchema>;
export type MemberCustomField = z.infer<typeof MemberCustomFieldSchema>;
export type Member = z.infer<typeof MemberSchema>;
