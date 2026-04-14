import { z } from 'astro/zod';

export const CommitteeSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
});

export const CommitteeMemberSchema = z.object({
  id: z.number(),
  committee_id: z.number(),
  member_id: z.number().nullable(),
  role: z.string(),
  joined_at: z.string(),
});

export type Committee = z.infer<typeof CommitteeSchema>;
export type CommitteeMember = z.infer<typeof CommitteeMemberSchema>;
