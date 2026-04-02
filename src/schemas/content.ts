import { z } from 'astro/zod';

export const AnnouncementSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
  is_pinned: z.boolean(),
  author_id: z.number().nullable(),
  created_at: z.string(),
});

export const ResourceSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  file_url: z.string().nullable(),
  file_type: z.string().nullable(),
  is_members_only: z.boolean(),
  uploaded_by: z.number().nullable(),
  created_at: z.string(),
});

export const PageSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  requires_auth: z.boolean(),
  show_in_nav: z.boolean(),
  nav_position: z.number().nullable(),
  published: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SectionSchema = z.object({
  id: z.number(),
  page_slug: z.string(),
  section_type: z.string(),
  config: z.any(),
  position: z.number(),
  visible: z.boolean(),
});

export const ReactionSchema = z.object({
  id: z.number(),
  content_type: z.string(),
  content_id: z.number(),
  member_id: z.number().nullable(),
  emoji: z.string(),
  created_at: z.string(),
});

export type Announcement = z.infer<typeof AnnouncementSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Reaction = z.infer<typeof ReactionSchema>;
