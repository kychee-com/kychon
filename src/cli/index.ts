import { createKychonClient, type JsonObject, type KychonClientOptions, type OperationPhase } from '@kychon/sdk';

export interface CliIo {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  env: Record<string, string | undefined>;
}

export type KychonClientFactory = (options: KychonClientOptions) => ReturnType<typeof createKychonClient>;

export async function runKychonCli(
  argv: string[],
  io: CliIo = { stdout: process.stdout, stderr: process.stderr, env: process.env },
  clientFactory: KychonClientFactory = createKychonClient,
): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const portalUrl = flagString(parsed.flags.portal) || io.env.KYCHON_PORTAL_URL;
    if (!portalUrl) throw new Error('Missing --portal or KYCHON_PORTAL_URL.');
    const client = clientFactory({ portalUrl, authToken: flagString(parsed.flags.token) || io.env.KYCHON_AUTH_TOKEN });
    const result = await dispatch(parsed.positionals, parsed.flags, client);
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function dispatch(positionals: string[], flags: Record<string, string | boolean>, client: ReturnType<typeof createKychonClient>) {
  const [scope, command, subcommand] = positionals;

  if (scope === 'api' && command === 'discover') return client.discover();
  if (scope === 'api' && command === 'capabilities') return client.capabilities();
  if (scope === 'api' && command === 'versions') return client.portal.version();
  if (scope === 'api' && command === 'call') {
    const envelope = parseJsonFlag(flags.json, 'api call requires --json.');
    const operation = String(envelope.operation || '');
    const phase = String(envelope.phase || 'query') as OperationPhase;
    return client.request(operation, phase, asObject(envelope.input), {
      idempotencyKey: typeof envelope.idempotencyKey === 'string' ? envelope.idempotencyKey : undefined,
      confirmed: typeof envelope.confirmed === 'boolean' ? envelope.confirmed : undefined,
    });
  }

  const input = parseJsonFlag(flags.json, '{}');
  const dryRun = flags['dry-run'] === true;
  const yes = flags.yes === true;

  if (scope === 'event' && command === 'create') return runMutation(client.events.create, input, dryRun, yes);
  if (scope === 'member' && command === 'approve') return runMutation(client.members.approve, input, dryRun, yes);
  if (scope === 'announcement' && command === 'publish') return runMutation(client.announcements.publish, input, dryRun, yes);
  if (scope === 'forum' && command === 'topic' && subcommand === 'create') return runMutation(client.forum.topics.create, input, dryRun, yes);
  if (scope === 'poll' && command === 'vote') return runMutation(client.polls.votes.cast, input, dryRun, yes);
  if (scope === 'moderation' && command === 'queue') return client.moderation.queue(input);
  if (scope === 'exports' && command === 'membersCsv') return runMutation(client.exports.membersCsv, input, dryRun, yes);
  if (scope === 'exports' && command === 'eventsCsv') return runMutation(client.exports.eventsCsv, input, dryRun, yes);
  if (scope === 'exports' && command === 'portalData') return runMutation(client.exports.portalData, input, dryRun, yes);

  throw new Error(`Unknown kychon command: ${positionals.join(' ')}`);
}

async function runMutation(
  helper: { validate(input?: JsonObject): Promise<unknown>; execute(input?: JsonObject, options?: { confirmed?: boolean }): Promise<unknown> },
  input: JsonObject,
  dryRun: boolean,
  yes: boolean,
) {
  if (dryRun || !yes) return helper.validate(input);
  return helper.execute(input, { confirmed: true });
}

function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

function parseJsonFlag(value: string | boolean | undefined, fallback: string): JsonObject {
  const raw = typeof value === 'string' ? value : fallback;
  try {
    return asObject(JSON.parse(raw));
  } catch {
    throw new Error(`Invalid JSON: ${raw}`);
  }
}

function flagString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
