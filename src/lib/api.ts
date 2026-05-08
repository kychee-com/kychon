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

function getStoredSession(): any {
  try {
    return JSON.parse(localStorage.getItem('wl_session') || 'null');
  } catch {
    localStorage.removeItem('wl_session');
    return null;
  }
}

function shouldRefresh(status: number, session: any): boolean {
  if (status === 401) return true;
  // PostgREST 403 can be caused by a stale/mismatched caller JWT as well as
  // real RLS denial. Refresh once when the browser has a refresh token; if the
  // fresh caller is still forbidden, the original API error path handles it.
  return status === 403 && !!session?.refresh_token;
}

function getAuthHeaders(session = getStoredSession()): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: getAnonKey(),
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function refreshToken(): Promise<any> {
  const session = getStoredSession();
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
  const session = getStoredSession();
  const headers = { ...getAuthHeaders(session), ...extra };
  const fetchOpts: RequestInit = { method, headers };
  if (body !== undefined) fetchOpts.body = JSON.stringify(body);

  let res = await fetch(url, fetchOpts);

  if (shouldRefresh(res.status, session) && retry) {
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

async function functionRequest(name: string, query: URLSearchParams, retry = true): Promise<any> {
  const url = `${getAPI()}/functions/v1/${name}?${query.toString()}`;
  const headers = getAuthHeaders();
  let res = await fetch(url, { headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed.access_token}`;
      res = await fetch(url, { headers });
    }
  }

  if (!res.ok) {
    const err: any = new Error(`Function ${name}: ${res.status}`);
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
    if (!total) return 0;
    return total === '*' ? 0 : parseInt(total, 10);
  }
  return 0;
}

export interface SiteSearchParams {
  q?: string;
  type?: string;
  page?: number;
  page_size?: number;
  suggest?: boolean;
}

export async function searchSite(params: SiteSearchParams): Promise<import('./search.js').SearchResponse> {
  const query = new URLSearchParams();
  if (params.q != null) query.set('q', params.q);
  if (params.type) query.set('type', params.type);
  if (params.page != null) query.set('page', String(params.page));
  if (params.page_size != null) query.set('page_size', String(params.page_size));
  if (params.suggest) query.set('suggest', '1');
  return functionRequest('site-search', query);
}

// --- Typed wrappers (Zod-validated) ---

import { z } from 'astro/zod';
import { EventRegistrationOptionSchema, EventSchema, EventRSVPSchema } from '../schemas/event.js';
import { MemberSchema, MemberTierSchema } from '../schemas/member.js';
import { SiteConfigRowSchema } from '../schemas/config.js';
import { AnnouncementSchema, ResourceSchema, SectionSchema, PageSchema, ReactionSchema } from '../schemas/content.js';
import { ForumCategorySchema, ForumTopicSchema, ForumReplySchema } from '../schemas/forum.js';
import { CommitteeSchema, CommitteeMemberSchema } from '../schemas/committee.js';
import { PollSchema, PollOptionSchema, PollVoteSchema } from '../schemas/poll.js';
import type { Event, EventRegistrationOption, EventRSVP } from '../schemas/event.js';
import type { Member, MemberTier } from '../schemas/member.js';
import type { SiteConfigRow } from '../schemas/config.js';
import type { Announcement, Resource, Section, Page, Reaction } from '../schemas/content.js';
import type { ForumCategory, ForumTopic, ForumReply } from '../schemas/forum.js';
import type { Committee, CommitteeMember } from '../schemas/committee.js';
import type { Poll, PollOption, PollVote } from '../schemas/poll.js';

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

export async function getEventRegistrationOptions(eventId: number): Promise<EventRegistrationOption[]> {
  const data = await get(`event_registration_options?event_id=eq.${eventId}&order=position.asc,id.asc`);
  return z.array(EventRegistrationOptionSchema).parse(data);
}

export async function getRegistrationOptionsForEvents(eventIds: number[]): Promise<EventRegistrationOption[]> {
  if (!eventIds.length) return [];
  const ids = eventIds.join(',');
  const data = await get(`event_registration_options?event_id=in.(${ids})&order=event_id.asc,position.asc,id.asc`);
  return z.array(EventRegistrationOptionSchema).parse(data);
}

export function createEventRegistrationOption(body: Record<string, unknown>): Promise<EventRegistrationOption[]> {
  return post('event_registration_options', body);
}

export function updateEventRegistrationOption(
  optionId: number,
  body: Record<string, unknown>,
): Promise<EventRegistrationOption[]> {
  return patch(`event_registration_options?id=eq.${optionId}`, body);
}

export function updateEventTimezone(eventId: number, body: Record<string, unknown>): Promise<Event[]> {
  return patch(`events?id=eq.${eventId}`, body);
}

export async function getEventWindow(startIso: string, endIso: string): Promise<Event[]> {
  // PostgREST concatenates repeated column filters in the query string instead
  // of AND-ing them, which produces a 400 ("time zone not recognized") on a
  // pair of starts_at filters. Use the explicit and=(...) form.
  const data = await get(
    `events?and=(starts_at.gte.${encodeURIComponent(startIso)},starts_at.lt.${encodeURIComponent(endIso)})&order=starts_at.asc`,
  );
  return z.array(EventSchema).parse(data);
}

export interface RsvpAvatar {
  event_id: number;
  member_id: number | null;
  members: { id: number; display_name: string | null; avatar_url: string | null } | null;
}

export async function getRsvpsForEvents(eventIds: number[]): Promise<RsvpAvatar[]> {
  if (!eventIds.length) return [];
  const ids = eventIds.join(',');
  const data = await get(
    `event_rsvps?event_id=in.(${ids})&status=eq.going&select=event_id,member_id,members(id,display_name,avatar_url)&limit=300`,
  );
  return Array.isArray(data) ? (data as RsvpAvatar[]) : [];
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
