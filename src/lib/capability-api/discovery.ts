import { KYCHON_API_VERSION, SUPPORTED_API_VERSIONS } from './types.js';
import { listOperations } from './operations.js';
import type { JsonObject } from './types.js';

export interface CapabilityDiscoveryOptions {
  portalUrl?: string;
  apiBaseUrl?: string;
  apiEndpoint?: string;
  engineVersion?: string;
  schemaVersion?: string;
  minimumSdkVersion?: string;
  recommendedSdkVersion?: string;
  cliVersion?: string;
}

export const DEFAULT_RUN402_API_BASE_URL = 'https://api.run402.com';
export const KYCHON_CAPABILITY_FUNCTION_PATH = '/functions/v1/kychon-api';

export function resolveCapabilityApiEndpoint(options: CapabilityDiscoveryOptions = {}): string {
  if (options.apiEndpoint) return options.apiEndpoint;
  const envApiBaseUrl = typeof process !== 'undefined' ? process.env.KYCHON_API_BASE_URL : undefined;
  const apiBaseUrl = (options.apiBaseUrl || envApiBaseUrl || DEFAULT_RUN402_API_BASE_URL).replace(/\/$/, '');
  return `${apiBaseUrl}${KYCHON_CAPABILITY_FUNCTION_PATH}`;
}

export function buildWellKnownKychon(options: CapabilityDiscoveryOptions = {}): JsonObject {
  const schemaVersion = options.schemaVersion || KYCHON_API_VERSION;
  const minimumSdkVersion = options.minimumSdkVersion || '0.1.0';
  const recommendedSdkVersion = options.recommendedSdkVersion || '0.1.0';
  const endpoint = resolveCapabilityApiEndpoint(options);

  return {
    product: {
      name: 'Kychon',
      category: 'membership-community-portal',
    },
    engine: {
      version: options.engineVersion || '0.1.0',
    },
    api: {
      endpoint,
      transport: 'run402-functions',
      currentVersion: KYCHON_API_VERSION,
      supportedVersions: [...SUPPORTED_API_VERSIONS],
      deprecatedVersions: [],
      authHeaders: {
        apiKey: 'apikey',
        bearerToken: 'Authorization',
      },
      publicKeySource: '/js/env.js',
    },
    schema: {
      version: schemaVersion,
      manifest: '/kychon-capabilities.json',
    },
    sdk: {
      package: '@kychon/sdk',
      minimumVersion: minimumSdkVersion,
      recommendedVersion: recommendedSdkVersion,
      firstDeliverable: true,
    },
    cli: {
      command: 'kychon',
      version: options.cliVersion || '0.1.0',
      thinWrapperOverSdk: true,
    },
    auth: {
      bearerToken: true,
      actorResolution: 'server',
      actorStates: [
        'anonymous',
        'authenticated_non_member',
        'pending_member',
        'active_member',
        'moderator',
        'admin',
        'project_admin',
      ],
    },
    docs: {
      llms: '/llms.txt',
      api: '/docs/kychon-api.md',
      sdk: '/docs/kychon-sdk.md',
      cli: '/docs/kychon-cli.md',
      examples: '/docs/kychon-api-examples.md',
    },
    ...(options.portalUrl ? { portalUrl: options.portalUrl } : {}),
  };
}

export function buildCapabilityManifest(options: CapabilityDiscoveryOptions = {}): JsonObject {
  const endpoint = resolveCapabilityApiEndpoint(options);
  return {
    product: 'Kychon',
    apiVersion: KYCHON_API_VERSION,
    schemaVersion: options.schemaVersion || KYCHON_API_VERSION,
    endpoint,
    transport: 'run402-functions',
    operations: listOperations().map((operation) => ({
      name: String(operation.name),
      phases: [...operation.phases],
      auth: {
        minimumActorState: operation.auth.minimumActorState,
        ...(operation.auth.permission ? { permission: operation.auth.permission } : {}),
        ...(operation.auth.allowAnonymous ? { allowAnonymous: true } : {}),
      },
      confirmation: operation.confirmation,
      costClass: operation.costClass,
      inputSchema: operation.inputSchema,
      outputSchema: operation.outputSchema,
      deprecation: {
        deprecated: operation.deprecation.deprecated,
        ...(operation.deprecation.since ? { since: operation.deprecation.since } : {}),
        ...(operation.deprecation.replacedBy ? { replacedBy: String(operation.deprecation.replacedBy) } : {}),
        ...(operation.deprecation.sunsetAt ? { sunsetAt: operation.deprecation.sunsetAt } : {}),
        ...(operation.deprecation.note ? { note: operation.deprecation.note } : {}),
      },
      summary: operation.summary,
    })),
    rawAccess: {
      available: true,
      level: 'low-level',
      guidance:
        'Use raw PostgREST or SQL for data/config customization and migrations; use capability operations for product workflows with permissions, side effects, idempotency, audit, or user trust implications.',
    },
    uiParity: {
      referenceRenderer: true,
      migrationDoc: '/docs/kychon-api-ui-parity.md',
      uiOnly: [
        {
          workflow: 'bundled-ui-direct-table-writes',
          rationale:
            'Existing Astro/UI workflows are migrating in documented slices; capability handlers define the target behavior during the transition.',
        },
      ],
    },
  };
}

export function buildPortalVersion(options: CapabilityDiscoveryOptions = {}): JsonObject {
  return {
    engineVersion: options.engineVersion || '0.1.0',
    apiCurrentVersion: KYCHON_API_VERSION,
    apiSupportedVersions: [...SUPPORTED_API_VERSIONS],
    apiDeprecatedVersions: [],
    schemaVersion: options.schemaVersion || KYCHON_API_VERSION,
    minimumSdkVersion: options.minimumSdkVersion || '0.1.0',
    recommendedSdkVersion: options.recommendedSdkVersion || '0.1.0',
    cliVersion: options.cliVersion || '0.1.0',
  };
}

export function buildLlmsTxt(options: CapabilityDiscoveryOptions = {}): string {
  const portalUrl = options.portalUrl?.replace(/\/$/, '') || '';
  const endpoint = resolveCapabilityApiEndpoint(options);
  const href = (path: string) => (path.startsWith('http://') || path.startsWith('https://') ? path : `${portalUrl}${path}`);

  return [
    '# Kychon',
    '',
    'Kychon is an API-first membership and community portal for Run402.',
    '',
    '## Capability API',
    `- Discovery: ${href('/.well-known/kychon.json')}`,
    `- Capability manifest: ${href('/kychon-capabilities.json')}`,
    `- API endpoint: ${href(endpoint)}`,
    `- Current API version: ${KYCHON_API_VERSION}`,
    '',
    '## Preferred Developer Surface',
    '- Use the typed @kychon/sdk first.',
    '- Use the kychon CLI as a thin SDK wrapper second.',
    '- Use raw PostgREST/SQL only for low-level customization or migrations.',
    '',
    '## Safe Operation Pattern',
    '- Read with phase=query.',
    '- Dry-run mutations with phase=validate.',
    '- Execute mutations with phase=execute, idempotencyKey, and confirmed=true when required.',
    '',
    '## Core Examples To Look For',
    '- auth.whoami',
    '- search.query',
    '- events.create',
    '- members.approve',
    '- announcements.publish',
    '- forum.topics.create',
    '- pollVotes.cast',
    '- resources.upload',
    '- exports.membersCsv',
    '',
  ].join('\n');
}
