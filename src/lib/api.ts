// api.ts — Thin REST wrapper around Run402 PostgREST API

declare global {
  interface Window {
    __KYCHON_API: string;
    __KYCHON_ANON_KEY: string;
  }
}

function getAPI(): string {
  return window.__KYCHON_API || 'https://api.run402.com';
}

function getAnonKey(): string {
  return window.__KYCHON_ANON_KEY || '';
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: getAnonKey(),
    'Content-Type': 'application/json',
  };
  const session = JSON.parse(localStorage.getItem('wl_session') || 'null');
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function refreshToken(): Promise<any> {
  const session = JSON.parse(localStorage.getItem('wl_session') || 'null');
  if (!session?.refresh_token) return null;
  const res = await fetch(`${getAPI()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    localStorage.removeItem('wl_session');
    return null;
  }
  const newSession = await res.json();
  localStorage.setItem('wl_session', JSON.stringify(newSession));
  return newSession;
}

interface RequestOpts {
  body?: any;
  headers?: Record<string, string>;
  retry?: boolean;
}

async function request(method: string, path: string, opts: RequestOpts = {}): Promise<any> {
  const { body, headers: extra, retry = true } = opts;
  const url = `${getAPI()}/rest/v1/${path}`;
  const headers = { ...getAuthHeaders(), ...extra };
  const fetchOpts: RequestInit = { method, headers };
  if (body !== undefined) fetchOpts.body = JSON.stringify(body);

  let res = await fetch(url, fetchOpts);

  if (res.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) {
      (headers as Record<string, string>).Authorization = `Bearer ${refreshed.access_token}`;
      fetchOpts.headers = headers;
      res = await fetch(url, fetchOpts);
    }
  }

  if (!res.ok) {
    const err: any = new Error(`API ${method} ${path}: ${res.status}`);
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {}
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function get(path: string): Promise<any> {
  return request('GET', path);
}

export function post(path: string, body: any): Promise<any> {
  return request('POST', path, { body, headers: { Prefer: 'return=representation' } });
}

export function patch(path: string, body: any): Promise<any> {
  return request('PATCH', path, { body, headers: { Prefer: 'return=representation' } });
}

export function del(path: string): Promise<any> {
  return request('DELETE', path);
}

export async function count(path: string): Promise<number> {
  const url = `${getAPI()}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: { ...getAuthHeaders(), Prefer: 'count=exact' },
  });
  const range = res.headers.get('Content-Range');
  if (range) {
    const total = range.split('/')[1];
    return total === '*' ? 0 : parseInt(total, 10);
  }
  return 0;
}

// --- Typed wrappers (Zod-validated) ---

import { z } from 'astro/zod';
import { EventSchema, EventRSVPSchema } from '../schemas/event';
import { MemberSchema, MemberTierSchema } from '../schemas/member';
import { SiteConfigRowSchema } from '../schemas/config';
import { AnnouncementSchema, ResourceSchema, SectionSchema, PageSchema, ReactionSchema } from '../schemas/content';
import { ForumCategorySchema, ForumTopicSchema, ForumReplySchema } from '../schemas/forum';
import { CommitteeSchema, CommitteeMemberSchema } from '../schemas/committee';
import { PollSchema, PollOptionSchema, PollVoteSchema } from '../schemas/poll';
import type { Event, EventRSVP } from '../schemas/event';
import type { Member, MemberTier } from '../schemas/member';
import type { SiteConfigRow } from '../schemas/config';
import type { Announcement, Resource, Section, Page, Reaction } from '../schemas/content';
import type { ForumCategory, ForumTopic, ForumReply } from '../schemas/forum';
import type { Committee, CommitteeMember } from '../schemas/committee';
import type { Poll, PollOption, PollVote } from '../schemas/poll';

export async function getConfig(): Promise<SiteConfigRow[]> {
  const data = await get('site_config');
  return z.array(SiteConfigRowSchema).parse(data);
}

export async function getEvents(query = ''): Promise<Event[]> {
  const data = await get(`events${query ? `?${query}` : '?order=starts_at.asc'}`);
  return z.array(EventSchema).parse(data);
}

export async function getEventRSVPs(eventId: number): Promise<EventRSVP[]> {
  const data = await get(`event_rsvps?event_id=eq.${eventId}`);
  return z.array(EventRSVPSchema).parse(data);
}

export async function getMembers(query = ''): Promise<Member[]> {
  const data = await get(`members${query ? `?${query}` : ''}`);
  return z.array(MemberSchema).parse(data);
}

export async function getMemberTiers(): Promise<MemberTier[]> {
  const data = await get('membership_tiers?order=position.asc');
  return z.array(MemberTierSchema).parse(data);
}

export async function getAnnouncements(query = ''): Promise<Announcement[]> {
  const data = await get(`announcements${query ? `?${query}` : '?order=is_pinned.desc,created_at.desc'}`);
  return z.array(AnnouncementSchema).parse(data);
}

export async function getResources(query = ''): Promise<Resource[]> {
  const data = await get(`resources${query ? `?${query}` : '?order=created_at.desc'}`);
  return z.array(ResourceSchema).parse(data);
}

export async function getSections(pageSlug = 'index'): Promise<Section[]> {
  const data = await get(`sections?page_slug=eq.${pageSlug}&visible=eq.true&order=position.asc`);
  return z.array(SectionSchema).parse(data);
}

export async function getPage(slug: string): Promise<Page | null> {
  const data = await get(`pages?slug=eq.${slug}&published=eq.true&limit=1`);
  const pages = z.array(PageSchema).parse(data);
  return pages[0] || null;
}

export async function getForumCategories(): Promise<ForumCategory[]> {
  const data = await get('forum_categories?order=position.asc');
  return z.array(ForumCategorySchema).parse(data);
}

export async function getForumTopics(query = ''): Promise<ForumTopic[]> {
  const data = await get(`forum_topics${query ? `?${query}` : '?order=is_pinned.desc,created_at.desc'}`);
  return z.array(ForumTopicSchema).parse(data);
}

export async function getForumReplies(topicId: number): Promise<ForumReply[]> {
  const data = await get(`forum_replies?topic_id=eq.${topicId}&order=created_at.asc`);
  return z.array(ForumReplySchema).parse(data);
}

export async function getReactions(contentType: string, contentId: number): Promise<Reaction[]> {
  const data = await get(`reactions?content_type=eq.${contentType}&content_id=eq.${contentId}`);
  return z.array(ReactionSchema).parse(data);
}

export async function getCommittees(): Promise<Committee[]> {
  const data = await get('committees?order=name.asc');
  return z.array(CommitteeSchema).parse(data);
}

export async function getCommitteeMembers(committeeId: number): Promise<CommitteeMember[]> {
  const data = await get(`committee_members?committee_id=eq.${committeeId}`);
  return z.array(CommitteeMemberSchema).parse(data);
}

export async function getPolls(query = ''): Promise<Poll[]> {
  const data = await get(`polls${query ? `?${query}` : '?order=created_at.desc'}`);
  return z.array(PollSchema).parse(data);
}

export async function getPollOptions(pollId: number): Promise<PollOption[]> {
  const data = await get(`poll_options?poll_id=eq.${pollId}&order=position.asc`);
  return z.array(PollOptionSchema).parse(data);
}

export async function getPollVotes(pollId: number): Promise<PollVote[]> {
  const data = await get(`poll_votes?poll_id=eq.${pollId}`);
  return z.array(PollVoteSchema).parse(data);
}

export { getAPI, getAnonKey, getAuthHeaders };
