import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_API_COMMON_SCHEMAS,
  ERROR_CODE_PATTERN,
  ERROR_CODES,
  getOperation,
  hasRegisteredOperation,
  isOperationName,
  KYCHON_API_VERSION,
  OBJECT_TYPE_PATTERN,
  OBJECT_TYPES,
  OPERATION_NAME_PATTERN,
  SUPPORTED_API_VERSIONS,
  V1_OPERATION_CATALOG,
} from '../../src/lib/capability-api/index.ts';

const expectedOperationNames = [
  'portal.discover',
  'portal.capabilities',
  'portal.health',
  'portal.version',
  'auth.whoami',
  'auth.permissions',
  'auth.explainDenied',
  'search.query',
  'search.suggest',
  'config.get',
  'config.set',
  'config.setMany',
  'config.branding.update',
  'config.theme.update',
  'config.general.update',
  'config.eventDisplay.update',
  'config.featureFlags.set',
  'pages.list',
  'pages.get',
  'pages.create',
  'pages.update',
  'pages.publish',
  'pages.unpublish',
  'pages.delete',
  'sections.list',
  'sections.get',
  'sections.create',
  'sections.updateConfig',
  'sections.reorder',
  'sections.setVisibility',
  'sections.setScope',
  'sections.setColumnSpan',
  'sections.delete',
  'members.list',
  'members.get',
  'members.updateProfile',
  'members.approve',
  'members.reject',
  'members.suspend',
  'members.reactivate',
  'members.changeTier',
  'members.changeRole',
  'members.setExpiration',
  'members.linkUser',
  'tiers.list',
  'tiers.create',
  'tiers.update',
  'tiers.delete',
  'tiers.setDefault',
  'tiers.reorder',
  'memberFields.list',
  'memberFields.create',
  'memberFields.update',
  'memberFields.delete',
  'memberFields.reorder',
  'events.list',
  'events.get',
  'events.create',
  'events.update',
  'events.delete',
  'events.setTimezone',
  'events.reviewImport',
  'registrationOptions.list',
  'registrationOptions.create',
  'registrationOptions.update',
  'registrationOptions.markReviewed',
  'registrationOptions.ignore',
  'registrationOptions.disable',
  'registrationOptions.enable',
  'rsvps.listForEvent',
  'rsvps.listMine',
  'rsvps.setStatus',
  'rsvps.cancel',
  'announcements.list',
  'announcements.get',
  'announcements.publish',
  'announcements.update',
  'announcements.pin',
  'announcements.unpin',
  'announcements.delete',
  'resources.list',
  'resources.get',
  'resources.upload',
  'resources.update',
  'resources.delete',
  'assets.upload',
  'forum.categories.list',
  'forum.categories.get',
  'forum.categories.create',
  'forum.categories.update',
  'forum.categories.reorder',
  'forum.categories.delete',
  'forum.topics.list',
  'forum.topics.get',
  'forum.topics.create',
  'forum.topics.update',
  'forum.topics.pin',
  'forum.topics.unpin',
  'forum.topics.lock',
  'forum.topics.unlock',
  'forum.topics.hide',
  'forum.topics.unhide',
  'forum.topics.delete',
  'forum.replies.list',
  'forum.replies.create',
  'forum.replies.update',
  'forum.replies.hide',
  'forum.replies.unhide',
  'forum.replies.delete',
  'polls.list',
  'polls.get',
  'polls.getAttached',
  'polls.create',
  'polls.update',
  'polls.attach',
  'polls.detach',
  'polls.close',
  'polls.reopen',
  'polls.delete',
  'pollOptions.list',
  'pollOptions.add',
  'pollOptions.update',
  'pollOptions.reorder',
  'pollOptions.delete',
  'pollVotes.list',
  'pollVotes.cast',
  'pollVotes.clearMine',
  'pollResults.get',
  'committees.list',
  'committees.get',
  'committees.create',
  'committees.update',
  'committees.delete',
  'committeeMembers.list',
  'committeeMembers.add',
  'committeeMembers.changeRole',
  'committeeMembers.remove',
  'reactions.list',
  'reactions.add',
  'reactions.remove',
  'reactions.toggle',
  'moderation.queue',
  'moderation.approve',
  'moderation.hide',
  'moderation.markReviewed',
  'translations.list',
  'translations.translateText',
  'translations.translateContent',
  'translations.delete',
  'newsletters.drafts.list',
  'newsletters.drafts.get',
  'newsletters.drafts.generate',
  'newsletters.drafts.update',
  'newsletters.drafts.delete',
  'insights.list',
  'insights.updateStatus',
  'insights.dismiss',
  'exports.membersCsv',
  'exports.eventsCsv',
  'exports.portalData',
  'activity.list',
  'activity.create',
  'jobs.checkExpirations',
  'jobs.sendEventReminders',
  'jobs.generateNewsletter',
  'jobs.status',
] as const;

function sorted(values: readonly string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

describe('Kychon Capability API contract foundation', () => {
  it('declares the initial explicit API version', () => {
    expect(KYCHON_API_VERSION).toBe('2026-05-08');
    expect(SUPPORTED_API_VERSIONS).toEqual([KYCHON_API_VERSION]);
  });

  it('registers every V1 operation from the OpenSpec catalog exactly once', () => {
    const names = V1_OPERATION_CATALOG.map((operation) => operation.name);
    expect(sorted(names)).toEqual(sorted(expectedOperationNames));
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses stable operation naming conventions', () => {
    for (const name of expectedOperationNames) {
      expect(name).toMatch(OPERATION_NAME_PATTERN);
      expect(isOperationName(name)).toBe(true);
      expect(hasRegisteredOperation(name)).toBe(true);
      expect(getOperation(name)?.name).toBe(name);
    }

    expect(isOperationName('create_event')).toBe(false);
    expect(isOperationName('Post.events')).toBe(false);
    expect(isOperationName('events.create!')).toBe(false);
    expect(hasRegisteredOperation('post.events')).toBe(false);
    expect(hasRegisteredOperation('events.create.validate')).toBe(false);
  });

  it('assigns query phases only to reads and validate/execute phases to mutations', () => {
    for (const operation of V1_OPERATION_CATALOG) {
      if (operation.name.endsWith('.list') || operation.name.endsWith('.get') || operation.name.endsWith('.query')) {
        expect(operation.phases).toEqual(['query']);
      }

      if (operation.phases.includes('execute')) {
        expect(operation.phases).toEqual(['validate', 'execute']);
        expect(operation.auth.allowAnonymous).toBe(false);
      }
    }
  });

  it('uses canonical object reference type names', () => {
    expect(OBJECT_TYPES).toContain('forum.topic');
    expect(OBJECT_TYPES).toContain('poll.vote');
    expect(OBJECT_TYPES).toContain('newsletterDraft');

    for (const type of OBJECT_TYPES) {
      expect(type).toMatch(OBJECT_TYPE_PATTERN);
    }
  });

  it('uses documented dotted error code families', () => {
    expect(ERROR_CODES).toContain('request.invalidJson');
    expect(ERROR_CODES).toContain('api.unsupportedVersion');
    expect(ERROR_CODES).toContain('permission.denied');

    for (const code of ERROR_CODES) {
      expect(code).toMatch(ERROR_CODE_PATTERN);
    }
  });

  it('exports JSON-serializable common schemas for SDKs, gateways, and manifests', () => {
    expect(JSON.parse(JSON.stringify(CAPABILITY_API_COMMON_SCHEMAS))).toEqual(CAPABILITY_API_COMMON_SCHEMAS);
    expect(CAPABILITY_API_COMMON_SCHEMAS.requestEnvelope.properties.phase.enum).toEqual([
      'query',
      'validate',
      'execute',
    ]);
  });
});
