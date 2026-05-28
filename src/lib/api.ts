// api.ts - Browser compatibility facade over the Kychon Capability API.
//
// The public app used to call Run402's PostgREST-shaped table surface directly.
// Keep the small get/post/patch/delete helpers so the UI can migrate
// incrementally, but make every product read/write go through
// @kychon/sdk and POST /functions/v1/kychon-api.

import {
  KYCHON_CAPABILITY_FUNCTION_PATH,
  createIdempotencyKey,
  createKychonClient,
  isKychonApiError,
  type ActionResult,
  type JsonObject,
  type JsonValue,
} from '@kychon/sdk';

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

function getBrowserStorage(): Storage | null {
  const globalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  if (globalStorage && 'value' in globalStorage && hasStorageShape(globalStorage.value)) {
    return globalStorage.value;
  }

  try {
    const storage = window.localStorage;
    if (hasStorageShape(storage)) return storage;
  } catch {
    return null;
  }
  return null;
}

function hasStorageShape(storage: unknown): storage is Storage {
  return (
    typeof storage === 'object' &&
    storage !== null &&
    typeof (storage as Storage).getItem === 'function' &&
    typeof (storage as Storage).setItem === 'function' &&
    typeof (storage as Storage).removeItem === 'function'
  );
}

function getStoredSession(): any {
  const storage = getBrowserStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem('wl_session') || 'null');
  } catch {
    storage.removeItem('wl_session');
    return null;
  }
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
  const storage = getBrowserStorage();
  const session = getStoredSession();
  if (!session?.refresh_token) return null;
  const res = await fetch(`${getAPI()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    storage?.removeItem('wl_session');
    return null;
  }
  const newSession = await res.json();
  storage?.setItem('wl_session', JSON.stringify(newSession));
  return newSession;
}

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is';

interface QueryFilter {
  field: string;
  op: FilterOp;
  value: JsonValue | JsonValue[];
}

interface QueryOrder {
  field: string;
  direction: 'asc' | 'desc';
}

interface ParsedPath {
  table: string;
  params: URLSearchParams;
  filters: QueryFilter[];
  order: QueryOrder[];
  limit: number | null;
  select: string;
}

const READ_OPERATION_BY_TABLE: Record<string, string> = {
  site_config: 'config.get',
  pages: 'pages.list',
  sections: 'sections.list',
  members: 'members.list',
  membership_tiers: 'tiers.list',
  member_custom_fields: 'memberFields.list',
  events: 'events.list',
  event_registration_options: 'registrationOptions.list',
  event_rsvps: 'rsvps.listForEvent',
  announcements: 'announcements.list',
  resources: 'resources.list',
  forum_categories: 'forum.categories.list',
  forum_topics: 'forum.topics.list',
  forum_replies: 'forum.replies.list',
  polls: 'polls.list',
  poll_options: 'pollOptions.list',
  poll_votes: 'pollVotes.list',
  committees: 'committees.list',
  committee_members: 'committeeMembers.list',
  reactions: 'reactions.list',
  moderation_log: 'moderation.queue',
  content_translations: 'translations.list',
  newsletter_drafts: 'newsletters.drafts.list',
  member_insights: 'insights.list',
  activity_log: 'activity.list',
};

const CREATE_OPERATION_BY_TABLE: Record<string, string> = {
  pages: 'pages.create',
  sections: 'sections.create',
  members: 'members.updateProfile',
  membership_tiers: 'tiers.create',
  member_custom_fields: 'memberFields.create',
  events: 'events.create',
  event_registration_options: 'registrationOptions.create',
  event_rsvps: 'rsvps.setStatus',
  announcements: 'announcements.publish',
  resources: 'resources.upload',
  forum_categories: 'forum.categories.create',
  forum_topics: 'forum.topics.create',
  forum_replies: 'forum.replies.create',
  polls: 'polls.create',
  poll_options: 'pollOptions.add',
  poll_votes: 'pollVotes.cast',
  committees: 'committees.create',
  committee_members: 'committeeMembers.add',
  reactions: 'reactions.add',
  activity_log: 'activity.create',
};

const UPDATE_OPERATION_BY_TABLE: Record<string, string> = {
  pages: 'pages.update',
  sections: 'sections.updateConfig',
  members: 'members.updateProfile',
  membership_tiers: 'tiers.update',
  member_custom_fields: 'memberFields.update',
  events: 'events.update',
  event_registration_options: 'registrationOptions.update',
  event_rsvps: 'rsvps.setStatus',
  announcements: 'announcements.update',
  resources: 'resources.update',
  forum_categories: 'forum.categories.update',
  forum_topics: 'forum.topics.update',
  forum_replies: 'forum.replies.update',
  polls: 'polls.update',
  poll_options: 'pollOptions.update',
  committees: 'committees.update',
  committee_members: 'committeeMembers.changeRole',
  reactions: 'reactions.toggle',
  moderation_log: 'moderation.markReviewed',
  content_translations: 'translations.translateContent',
  newsletter_drafts: 'newsletters.drafts.update',
  member_insights: 'insights.updateStatus',
};

const DELETE_OPERATION_BY_TABLE: Record<string, string> = {
  pages: 'pages.delete',
  sections: 'sections.delete',
  membership_tiers: 'tiers.delete',
  member_custom_fields: 'memberFields.delete',
  events: 'events.delete',
  announcements: 'announcements.delete',
  resources: 'resources.delete',
  forum_categories: 'forum.categories.delete',
  forum_topics: 'forum.topics.delete',
  forum_replies: 'forum.replies.delete',
  polls: 'polls.delete',
  poll_options: 'pollOptions.delete',
  committees: 'committees.delete',
  committee_members: 'committeeMembers.remove',
  reactions: 'reactions.remove',
  content_translations: 'translations.delete',
  newsletter_drafts: 'newsletters.drafts.delete',
};

function capabilityClient(sessionOverride?: any) {
  return createKychonClient({
    portalUrl: window.location?.origin || 'https://kychon.com',
    apiBaseUrl: getAPI(),
    apiEndpoint: `${getAPI()}${KYCHON_CAPABILITY_FUNCTION_PATH}`,
    apiKey: () => getAnonKey(),
    authToken: () => sessionOverride?.access_token || getStoredSession()?.access_token || null,
  });
}

function shouldRefreshCapability(error: unknown, session: any): boolean {
  if (!session?.refresh_token || !isKychonApiError(error)) return false;
  return error.code === 'permission.denied' || error.code.startsWith('auth.');
}

async function callCapability<T>(fn: () => Promise<T>, retry = true, sessionOverride?: any): Promise<T> {
  const session = sessionOverride || getStoredSession();
  try {
    return await fn();
  } catch (error) {
    if (!retry || !shouldRefreshCapability(error, session)) throw error;
    const refreshed = await refreshToken();
    if (!refreshed) throw error;
    return fn();
  }
}

function parsePath(path: string): ParsedPath {
  const [rawTable = '', rawQuery = ''] = path.split('?');
  const table = decodeURIComponent(rawTable.replace(/^\/+/, '').trim());
  const params = new URLSearchParams(rawQuery);
  const filters: QueryFilter[] = [];

  for (const [key, value] of params.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    if (key === 'and') {
      filters.push(...parseAndFilters(value));
      continue;
    }
    const filter = parseFilter(key, value);
    if (filter) filters.push(filter);
  }

  return {
    table,
    params,
    filters,
    order: parseOrder(params),
    limit: parseLimit(params.get('limit')),
    select: params.get('select') || '',
  };
}

function parseAndFilters(value: string): QueryFilter[] {
  const inner = value.startsWith('(') && value.endsWith(')') ? value.slice(1, -1) : value;
  return inner
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const first = part.indexOf('.');
      const second = part.indexOf('.', first + 1);
      if (first < 0 || second < 0) return null;
      return parseFilter(part.slice(0, first), `${part.slice(first + 1, second)}.${part.slice(second + 1)}`);
    })
    .filter((filter): filter is QueryFilter => !!filter);
}

function parseFilter(field: string, value: string): QueryFilter | null {
  for (const op of ['not.is', 'neq', 'gte', 'lte', 'gt', 'lt', 'eq', 'in', 'is'] as const) {
    const prefix = `${op}.`;
    if (!value.startsWith(prefix)) continue;
    const normalizedOp = op === 'not.is' ? 'neq' : op;
    const raw = value.slice(prefix.length);
    return {
      field,
      op: normalizedOp as FilterOp,
      value: normalizedOp === 'in' ? parseInValues(raw) : parseFilterValue(raw),
    };
  }
  return null;
}

function parseInValues(raw: string): JsonValue[] {
  const inner = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw;
  if (!inner) return [];
  return inner.split(',').map((part) => parseFilterValue(part.trim()));
}

function parseFilterValue(raw: string): JsonValue {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'now()') return new Date().toISOString();
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function parseOrder(params: URLSearchParams): QueryOrder[] {
  const out: QueryOrder[] = [];
  for (const value of params.getAll('order')) {
    for (const part of value.split(',')) {
      const [field, direction = 'asc'] = part.split('.');
      if (!field) continue;
      out.push({ field, direction: direction === 'desc' ? 'desc' : 'asc' });
    }
  }
  return out;
}

function parseLimit(raw: string | null): number | null {
  if (!raw) return null;
  const limit = Number(raw);
  return Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : null;
}

function readInputFor(parsed: ParsedPath): JsonObject {
  const input: JsonObject = {};
  if (parsed.filters.length) input.filters = parsed.filters as unknown as JsonValue;
  if (parsed.order.length) input.order = parsed.order as unknown as JsonValue;
  if (parsed.limit != null) input.limit = parsed.limit;
  for (const filter of parsed.filters) {
    if (filter.op !== 'eq') continue;
    input[filter.field] = filter.value as JsonValue;
    const camel = camelInputKey(filter.field);
    if (camel !== filter.field) input[camel] = filter.value as JsonValue;
  }
  return input;
}

function camelInputKey(field: string): string {
  return field.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function rowsFromQueryResult(result: JsonValue): any[] {
  if (Array.isArray(result)) return result;
  if (isRecord(result) && Array.isArray(result.rows)) return result.rows;
  return result == null ? [] : [result];
}

function rowFromActionResult(result: unknown): any {
  if (isRecord(result) && 'result' in result) return (result as unknown as ActionResult<JsonValue>).result;
  return result;
}

function representation(result: unknown): any[] {
  const row = rowFromActionResult(result);
  if (Array.isArray(row)) return row;
  return row == null ? [] : [row];
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asJsonObject(value: any): JsonObject {
  return isRecord(value) ? (value as JsonObject) : {};
}

function firstEqFilter(parsed: ParsedPath, field: string): JsonValue | null {
  const filter = parsed.filters.find((item) => item.field === field && item.op === 'eq');
  return filter ? (filter.value as JsonValue) : null;
}

function inputWithPathId(parsed: ParsedPath, body: any): JsonObject {
  const input = { ...asJsonObject(body) };
  const id = firstEqFilter(parsed, 'id');
  if (id != null) input.id = id;
  const key = firstEqFilter(parsed, 'key');
  if (key != null) input.key = key;
  return input;
}

function filterRows(rows: any[], filters: QueryFilter[]): any[] {
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((filter) => rowMatchesFilter(row, filter)));
}

function rowMatchesFilter(row: any, filter: QueryFilter): boolean {
  if (!row || !(filter.field in row)) return true;
  const actual = row?.[filter.field];
  if (filter.op === 'in') {
    return Array.isArray(filter.value) && filter.value.some((expected) => valuesEqual(actual, expected));
  }
  if (filter.op === 'is') return valuesEqual(actual, filter.value);
  if (filter.op === 'eq') return valuesEqual(actual, filter.value);
  if (filter.op === 'neq') return !valuesEqual(actual, filter.value);

  const left = comparableValue(actual);
  const right = comparableValue(filter.value as JsonValue);
  if (left == null || right == null) return false;
  if (filter.op === 'gt') return left > right;
  if (filter.op === 'gte') return left >= right;
  if (filter.op === 'lt') return left < right;
  if (filter.op === 'lte') return left <= right;
  return true;
}

function valuesEqual(actual: unknown, expected: JsonValue): boolean {
  if (actual == null || expected == null) return actual == null && expected == null;
  return String(actual) === String(expected);
}

function comparableValue(value: unknown): number | string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== '') return numeric;
  const date = Date.parse(String(value));
  return Number.isFinite(date) ? date : String(value);
}

function sortRows(rows: any[], order: QueryOrder[]): any[] {
  if (!order.length) return rows;
  return [...rows].sort((a, b) => {
    for (const item of order) {
      const left = comparableValue(a?.[item.field]);
      const right = comparableValue(b?.[item.field]);
      if (left === right) continue;
      if (left == null) return 1;
      if (right == null) return -1;
      const direction = item.direction === 'desc' ? -1 : 1;
      return left > right ? direction : -direction;
    }
    return 0;
  });
}

function maybeLimit(rows: any[], limit: number | null): any[] {
  return limit == null ? rows : rows.slice(0, limit);
}

async function hydrateSelectedRelations(rows: any[], select: string): Promise<any[]> {
  if (!select.includes('members(') || rows.length === 0) return rows;
  const ids = Array.from(new Set(rows.map((row) => row.member_id).filter((id) => id != null)));
  if (!ids.length) return rows;
  const members = await get(`members?id=in.(${ids.join(',')})`);
  const byId = new Map(members.map((member: any) => [String(member.id), member]));
  return rows.map((row) => ({
    ...row,
    members: row.member_id == null ? null : byId.get(String(row.member_id)) || null,
  }));
}

async function queryPath(path: string): Promise<any[]> {
  const parsed = parsePath(path);
  const operation = READ_OPERATION_BY_TABLE[parsed.table];
  if (!operation) throw new Error(`Unsupported Kychon API read path: ${path}`);

  const result = await callCapability(() =>
    capabilityClient().request<JsonValue>(operation, 'query', readInputFor(parsed)),
  );
  const normalized = normalizeRowsForTable(parsed.table, rowsFromQueryResult(result));
  const rows = maybeLimit(sortRows(filterRows(normalized, parsed.filters), parsed.order), parsed.limit);
  return hydrateSelectedRelations(rows, parsed.select);
}

export async function getCurrentActorContext(): Promise<any> {
  return callCapability(() => capabilityClient().request<JsonValue>('auth.whoami', 'query', {}));
}

function normalizeRowsForTable(table: string, rows: any[]): any[] {
  if (table !== 'members') return rows;
  return rows.map((row) => ({
    user_id: null,
    email: '',
    custom_fields: {},
    joined_at: row.joined_at || row.created_at || '',
    expires_at: null,
    created_at: row.created_at || row.joined_at || '',
    updated_at: row.updated_at || row.created_at || row.joined_at || '',
    status: 'active',
    ...row,
  }));
}

function createInputFor(parsed: ParsedPath, body: any): JsonObject {
  const input = asJsonObject(body);
  if (parsed.table === 'site_config') {
    return {
      key: input.key ?? firstEqFilter(parsed, 'key'),
      value: input.value ?? null,
      category: input.category ?? 'general',
    };
  }
  if (parsed.table === 'resources') {
    return {
      ...input,
      metadata: { ...input },
      fileUrl: input.fileUrl ?? input.file_url ?? null,
    };
  }
  if (parsed.table === 'poll_votes') {
    const pollId = input.pollId ?? input.poll_id;
    const optionId = input.optionId ?? input.option_id;
    return {
      ...input,
      ...(pollId !== undefined ? { pollId } : {}),
      ...(optionId !== undefined ? { optionId } : {}),
    };
  }
  if (parsed.table === 'event_rsvps') {
    return {
      ...input,
      eventId: input.eventId ?? input.event_id ?? firstEqFilter(parsed, 'event_id'),
      memberId: input.memberId ?? input.member_id ?? firstEqFilter(parsed, 'member_id'),
    };
  }
  return input;
}

function updateOperationFor(parsed: ParsedPath, body: any): string {
  const input = asJsonObject(body);
  if (parsed.table === 'site_config') return 'config.set';
  if (parsed.table === 'members') {
    if (input.status === 'active') return 'members.approve';
    if (input.status === 'rejected') return 'members.reject';
    if (input.status === 'suspended') return 'members.suspend';
    if ('tier_id' in input) return 'members.changeTier';
    if ('role' in input) return 'members.changeRole';
    if ('expires_at' in input) return 'members.setExpiration';
    if ('user_id' in input) return 'members.linkUser';
  }
  if (parsed.table === 'moderation_log') {
    if (input.action === 'approved') return 'moderation.approve';
    if (input.action === 'hidden') return 'moderation.hide';
  }
  return UPDATE_OPERATION_BY_TABLE[parsed.table] || '';
}

function updateInputFor(parsed: ParsedPath, body: any): JsonObject {
  const input = inputWithPathId(parsed, body);
  if (parsed.table === 'site_config') {
    return {
      key: input.key ?? firstEqFilter(parsed, 'key') ?? null,
      value: input.value ?? null,
      category: input.category ?? 'general',
    };
  }
  if (parsed.table === 'members') {
    if ('tier_id' in input) input.tierId = input.tier_id;
    if ('expires_at' in input) input.expiresAt = input.expires_at;
    if ('user_id' in input) input.userId = input.user_id;
  }
  if (parsed.table === 'event_rsvps') {
    input.eventId = input.eventId ?? input.event_id ?? firstEqFilter(parsed, 'event_id');
    input.memberId = input.memberId ?? input.member_id ?? firstEqFilter(parsed, 'member_id');
  }
  return input;
}

async function executeOperation(operation: string, input: JsonObject, sessionOverride?: any): Promise<any[]> {
  if (!operation) throw new Error('Unsupported Kychon API mutation.');
  const result = await callCapability(() =>
    capabilityClient(sessionOverride).execute<ActionResult<JsonValue>>(operation, input, {
      confirmed: true,
      idempotencyKey: createIdempotencyKey(operation.replace(/\./g, '-')),
    }),
    true,
    sessionOverride,
  );
  return representation(result);
}

export function get(path: string): Promise<any> {
  return queryPath(path);
}

/**
 * admin-content-management: invoke an arbitrary capability mutation by name.
 * Use when the operation isn't a generic table CRUD covered by post/patch/del
 * (e.g. `media.list`, `media.delete`, `sections.translate`,
 * `sections.getTranslation`). Returns the operation's `result` payload.
 */
export async function execOp(operation: string, input: JsonObject = {}): Promise<any> {
  const result = await callCapability(() =>
    capabilityClient().execute<ActionResult<JsonValue>>(operation, input, {
      confirmed: true,
      idempotencyKey: createIdempotencyKey(operation.replace(/\./g, '-')),
    }),
    true,
  );
  return (result as { result?: unknown } | null)?.result ?? null;
}

/**
 * admin-content-management: invoke an arbitrary capability QUERY by name.
 * For reads that aren't a PostgREST-style table path.
 */
export async function queryOp(operation: string, input: JsonObject = {}): Promise<any> {
  const result = await callCapability(() =>
    capabilityClient().request<JsonValue>(operation, 'query', input),
    false,
  );
  return result;
}

export async function post(path: string, body: any): Promise<any> {
  const parsed = parsePath(path);
  const operation = parsed.table === 'site_config' ? 'config.set' : CREATE_OPERATION_BY_TABLE[parsed.table] || '';
  return executeOperation(operation, createInputFor(parsed, body));
}

export async function patch(path: string, body: any, sessionOverride?: any): Promise<any> {
  const parsed = parsePath(path);
  return executeOperation(updateOperationFor(parsed, body), updateInputFor(parsed, body), sessionOverride);
}

export async function del(path: string): Promise<any> {
  const parsed = parsePath(path);

  if (parsed.table === 'event_rsvps') {
    const input: JsonObject = {};
    const id = firstEqFilter(parsed, 'id');
    const eventId = firstEqFilter(parsed, 'event_id');
    const memberId = firstEqFilter(parsed, 'member_id');
    if (id != null) input.id = id;
    if (eventId != null) input.eventId = eventId;
    if (memberId != null) input.memberId = memberId;
    await executeOperation('rsvps.cancel', input);
    return null;
  }

  if (parsed.table === 'poll_votes') {
    const id = firstEqFilter(parsed, 'id');
    if (id != null) {
      const [vote] = await queryPath(path);
      if (vote?.poll_id) {
        const [poll] = await queryPath(`polls?id=eq.${vote.poll_id}`);
        const opInput: JsonObject = { pollId: vote.poll_id };
        if (poll?.poll_type === 'multiple') opInput.optionId = vote.option_id;
        await executeOperation(poll?.poll_type === 'multiple' ? 'pollVotes.cast' : 'pollVotes.clearMine', opInput);
      }
      return null;
    }
    const pollId = firstEqFilter(parsed, 'poll_id');
    await executeOperation('pollVotes.clearMine', pollId == null ? {} : { pollId });
    return null;
  }

  const operation = DELETE_OPERATION_BY_TABLE[parsed.table];
  if (!operation) throw new Error(`Unsupported Kychon API delete path: ${path}`);
  const id = firstEqFilter(parsed, 'id');
  const rows = id == null ? await queryPath(path) : [{ id }];
  await Promise.all(rows.map((row) => executeOperation(operation, { id: row.id })));
  return null;
}

export async function count(path: string): Promise<number> {
  return (await get(path)).length;
}

export interface SiteSearchParams {
  q?: string;
  type?: string;
  page?: number;
  page_size?: number;
  suggest?: boolean;
}

export async function searchSite(params: SiteSearchParams): Promise<import('./search.js').SearchResponse> {
  const input: JsonObject = {};
  if (params.q != null) input.q = params.q;
  if (params.type) input.type = params.type;
  if (params.page != null) input.page = params.page;
  if (params.page_size != null) input.page_size = params.page_size;
  const operation = params.suggest ? 'search.suggest' : 'search.query';
  return callCapability(() =>
    capabilityClient().request<import('./search.js').SearchResponse>(operation, 'query', input),
  );
}

// --- Typed wrappers ---

import type { Event, EventRegistrationOption, EventRSVP } from '../schemas/event.js';
import type { Member, MemberTier } from '../schemas/member.js';
import type { SiteConfigRow } from '../schemas/config.js';
import type { Announcement, Resource, Section, Page, Reaction } from '../schemas/content.js';
import type { ForumCategory, ForumTopic, ForumReply } from '../schemas/forum.js';
import type { Committee, CommitteeMember } from '../schemas/committee.js';
import type { Poll, PollOption, PollVote } from '../schemas/poll.js';

export async function getConfig(): Promise<SiteConfigRow[]> {
  const data = await get('site_config');
  return data as SiteConfigRow[];
}

export async function getEvents(query = ''): Promise<Event[]> {
  const data = await get(`events${query ? `?${query}` : '?order=starts_at.asc'}`);
  return data as Event[];
}

export async function getEventRSVPs(eventId: number): Promise<EventRSVP[]> {
  const data = await get(`event_rsvps?event_id=eq.${eventId}`);
  return data as EventRSVP[];
}

export async function getEventRegistrationOptions(eventId: number): Promise<EventRegistrationOption[]> {
  const data = await get(`event_registration_options?event_id=eq.${eventId}&order=position.asc,id.asc`);
  return data as EventRegistrationOption[];
}

export async function getRegistrationOptionsForEvents(eventIds: number[]): Promise<EventRegistrationOption[]> {
  if (!eventIds.length) return [];
  const ids = eventIds.join(',');
  const data = await get(`event_registration_options?event_id=in.(${ids})&order=event_id.asc,position.asc,id.asc`);
  return data as EventRegistrationOption[];
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
  return data as Event[];
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
  return data as Member[];
}

export async function getMemberTiers(): Promise<MemberTier[]> {
  const data = await get('membership_tiers?order=position.asc');
  return data as MemberTier[];
}

export async function getAnnouncements(query = ''): Promise<Announcement[]> {
  const data = await get(`announcements${query ? `?${query}` : '?order=is_pinned.desc,created_at.desc'}`);
  return data as Announcement[];
}

export async function getResources(query = ''): Promise<Resource[]> {
  const data = await get(`resources${query ? `?${query}` : '?order=created_at.desc'}`);
  return data as Resource[];
}

export async function getSections(pageSlug = 'index'): Promise<Section[]> {
  const data = await get(`sections?page_slug=eq.${pageSlug}&visible=eq.true&order=position.asc`);
  return data as Section[];
}

export async function getPage(slug: string): Promise<Page | null> {
  const data = await get(`pages?slug=eq.${slug}&published=eq.true&limit=1`);
  const pages = data as Page[];
  return pages[0] || null;
}

export async function getForumCategories(): Promise<ForumCategory[]> {
  const data = await get('forum_categories?order=position.asc');
  return data as ForumCategory[];
}

export async function getForumTopics(query = ''): Promise<ForumTopic[]> {
  const data = await get(`forum_topics${query ? `?${query}` : '?order=is_pinned.desc,created_at.desc'}`);
  return data as ForumTopic[];
}

export async function getForumReplies(topicId: number): Promise<ForumReply[]> {
  const data = await get(`forum_replies?topic_id=eq.${topicId}&order=created_at.asc`);
  return data as ForumReply[];
}

export async function getReactions(contentType: string, contentId: number): Promise<Reaction[]> {
  const data = await get(`reactions?content_type=eq.${contentType}&content_id=eq.${contentId}`);
  return data as Reaction[];
}

export async function getCommittees(): Promise<Committee[]> {
  const data = await get('committees?order=name.asc');
  return data as Committee[];
}

export async function getCommitteeMembers(committeeId: number): Promise<CommitteeMember[]> {
  const data = await get(`committee_members?committee_id=eq.${committeeId}`);
  return data as CommitteeMember[];
}

export async function getPolls(query = ''): Promise<Poll[]> {
  const data = await get(`polls${query ? `?${query}` : '?order=created_at.desc'}`);
  return data as Poll[];
}

export async function getPollOptions(pollId: number): Promise<PollOption[]> {
  const data = await get(`poll_options?poll_id=eq.${pollId}&order=position.asc`);
  return data as PollOption[];
}

export async function getPollVotes(pollId: number): Promise<PollVote[]> {
  const data = await get(`poll_votes?poll_id=eq.${pollId}`);
  return data as PollVote[];
}

export { getAPI, getAnonKey, getAuthHeaders };
