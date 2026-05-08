import { z } from 'astro/zod';

const InteractionStateSchema = z.object({
  background: z.string().optional(),
  text: z.string().optional(),
  icon: z.string().optional(),
  border: z.string().optional(),
  shadow: z.string().optional(),
  transform: z.string().optional(),
  duration: z.string().optional(),
  easing: z.string().optional(),
}).partial();

const InteractionSchema = z.object({
  default: z.object({
    hover: InteractionStateSchema.optional(),
    focus: InteractionStateSchema.optional(),
  }).partial().optional(),
  button: z.object({
    hover: InteractionStateSchema.optional(),
    focus: InteractionStateSchema.optional(),
  }).partial().optional(),
  card: z.object({
    hover: InteractionStateSchema.optional(),
    focus: InteractionStateSchema.optional(),
  }).partial().optional(),
  social: z.object({
    hover: InteractionStateSchema.optional(),
    focus: InteractionStateSchema.optional(),
  }).partial().optional(),
}).partial();

export const ThemeSchema = z.object({
  color_scheme: z.enum(['adaptive', 'source']).optional(),
  primary: z.string().optional(),
  primary_hover: z.string().optional(),
  accent: z.string().optional(),
  bg: z.string().optional(),
  surface: z.string().optional(),
  text: z.string().optional(),
  text_muted: z.string().optional(),
  border: z.string().optional(),
  font_heading: z.string().optional(),
  font_body: z.string().optional(),
  radius: z.string().optional(),
  max_width: z.string().optional(),
  interactions: InteractionSchema.optional(),
  header: z.object({
    padding: z.string().optional(),
    background: z.string().optional(),
    border_bottom: z.string().optional(),
    shadow: z.string().optional(),
    gap: z.string().optional(),
    wrap: z.string().optional(),
    align_items: z.string().optional(),
    logo_max_height: z.string().optional(),
    logo_max_width: z.string().optional(),
    wordmark_max_height: z.string().optional(),
    brand_text_color: z.string().optional(),
    brand_text_size: z.string().optional(),
    brand_text_weight: z.string().optional(),
  }).partial().optional(),
  nav: z.object({
    link_color: z.string().optional(),
    link_hover_bg: z.string().optional(),
    link_hover_color: z.string().optional(),
    link_active_bg: z.string().optional(),
    link_active_color: z.string().optional(),
    link_gap: z.string().optional(),
    link_padding: z.string().optional(),
    link_radius: z.string().optional(),
    font_family: z.string().optional(),
    font_size: z.string().optional(),
    font_weight: z.string().optional(),
    surface_bg: z.string().optional(),
    surface_padding: z.string().optional(),
    surface_radius: z.string().optional(),
    surface_shadow: z.string().optional(),
    full_row: z.boolean().optional(),
    wrap: z.string().optional(),
    dropdown_bg: z.string().optional(),
    dropdown_color: z.string().optional(),
    dropdown_hover_bg: z.string().optional(),
    dropdown_hover_color: z.string().optional(),
    dropdown_border: z.string().optional(),
    dropdown_shadow: z.string().optional(),
    dropdown_width: z.string().optional(),
    chevron_color: z.string().optional(),
    transition: z.string().optional(),
    mobile_menu_bg: z.string().optional(),
    mobile_menu_padding: z.string().optional(),
  }).partial().optional(),
  social: z.object({
    size: z.string().optional(),
    icon_size: z.string().optional(),
    radius: z.string().optional(),
    bg: z.string().optional(),
    color: z.string().optional(),
    border: z.string().optional(),
    gap: z.string().optional(),
    justify: z.string().optional(),
  }).partial().optional(),
  footer: z.object({
    background: z.string().optional(),
    text: z.string().optional(),
    link_color: z.string().optional(),
    heading_color: z.string().optional(),
    border_top: z.string().optional(),
    padding: z.string().optional(),
    text_align: z.string().optional(),
    link_columns: z.string().optional(),
    link_gap: z.string().optional(),
  }).partial().optional(),
  carousel: z.object({
    arrow: z.object({
      background: z.string().optional(),
      text: z.string().optional(),
      hover: InteractionStateSchema.optional(),
    }).partial().optional(),
    dot: z.object({
      background: z.string().optional(),
      active_background: z.string().optional(),
    }).partial().optional(),
  }).partial().optional(),
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
