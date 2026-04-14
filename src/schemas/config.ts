import { z } from 'astro/zod';

export const ThemeSchema = z.object({
  primary: z.string().optional(),
  primary_hover: z.string().optional(),
  bg: z.string().optional(),
  surface: z.string().optional(),
  text: z.string().optional(),
  text_muted: z.string().optional(),
  border: z.string().optional(),
  font_heading: z.string().optional(),
  font_body: z.string().optional(),
  radius: z.string().optional(),
  max_width: z.string().optional(),
});

export const NavItemSchema = z.object({
  label: z.string(),
  href: z.string(),
  feature: z.string().optional(),
  auth: z.boolean().optional(),
  admin: z.boolean().optional(),
});

export const SiteConfigRowSchema = z.object({
  key: z.string(),
  value: z.any(),
  category: z.string(),
});

export type Theme = z.infer<typeof ThemeSchema>;
export type NavItem = z.infer<typeof NavItemSchema>;
export type SiteConfigRow = z.infer<typeof SiteConfigRowSchema>;
