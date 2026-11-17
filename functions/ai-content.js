// AI content generation — newsletter drafts + event recaps
// schedule: none — an admin runs it, or the owner through a Run402 function run.
import { adminDb, auth } from '@run402/functions';

export default async (req) => {
  // A run spends the portal's AI key and writes newsletter drafts or public
  // announcements, so anonymous callers must not start one.
  const denied = await authorizeRun(req, adminDb());
  if (denied) return denied;

  // Route: if request has event_id body, handle recap; otherwise handle newsletter
  let body = {};
  try {
    body = await req.json();
  } catch {}

  if (body.event_id) {
    return handleRecap(body.event_id);
  }
  return handleNewsletter();
};

// --- Newsletter ---

async function handleNewsletter() {
  const flag = await adminDb().from('site_config').select('value').eq('key', 'feature_ai_newsletter').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_newsletter disabled' }));
  }

  if (!process.env.AI_API_KEY) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'AI_API_KEY not set' }));
  }

  const provider = process.env.AI_PROVIDER || 'openai';
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();

  const activity = await gatherWeeklyActivity(weekAgoISO);

  if (!activity.hasContent) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'no activity in the past week' }));
  }

  const siteName = await getSiteName();

  try {
    const newsletter = await generateNewsletter(provider, siteName, activity);

    await adminDb()
      .from('newsletter_drafts')
      .insert({
        subject: newsletter.subject,
        body: sanitizeRichHtmlServer(newsletter.body),
        status: 'draft',
        period_start: weekAgoISO,
        period_end: now.toISOString(),
      });

    return new Response(JSON.stringify({ status: 'ok', subject: newsletter.subject }));
  } catch (e) {
    console.error('Newsletter generation failed:', e.message);
    return new Response(JSON.stringify({ status: 'error', error: e.message }), { status: 500 });
  }
}

async function gatherWeeklyActivity(since) {
  const [newMembers, upcomingEvents, announcements, topForumPosts, newResources] = await Promise.all([
    adminDb().from('members').select('display_name').gte('joined_at', since).eq('status', 'active'),
    adminDb()
      .from('events')
      .select('title,starts_at,location')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5),
    adminDb()
      .from('announcements')
      .select('title,body')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    adminDb()
      .from('forum_topics')
      .select('title,reply_count')
      .gte('created_at', since)
      .order('reply_count', { ascending: false })
      .limit(5),
    adminDb().from('resources').select('title,category').gte('created_at', since).limit(5),
  ]);

  const hasContent =
    newMembers.length > 0 ||
    upcomingEvents.length > 0 ||
    announcements.length > 0 ||
    topForumPosts.length > 0 ||
    newResources.length > 0;

  return { newMembers, upcomingEvents, announcements, topForumPosts, newResources, hasContent };
}

async function generateNewsletter(provider, siteName, activity) {
  const sections = [];
  if (activity.newMembers.length > 0) {
    sections.push(`New members this week: ${activity.newMembers.map((m) => m.display_name).join(', ')}`);
  }
  if (activity.upcomingEvents.length > 0) {
    sections.push(
      'Upcoming events:\n' +
        activity.upcomingEvents
          .map(
            (e) =>
              `- ${e.title} on ${new Date(e.starts_at).toLocaleDateString()}${e.location ? ` at ${e.location}` : ''}`,
          )
          .join('\n'),
    );
  }
  if (activity.announcements.length > 0) {
    sections.push(`Recent announcements:\n${activity.announcements.map((a) => `- ${a.title}`).join('\n')}`);
  }
  if (activity.topForumPosts.length > 0) {
    sections.push(
      'Popular discussions:\n' +
        activity.topForumPosts.map((p) => `- ${p.title} (${p.reply_count} replies)`).join('\n'),
    );
  }
  if (activity.newResources.length > 0) {
    sections.push(
      'New resources:\n' +
        activity.newResources.map((r) => `- ${r.title}${r.category ? ` (${r.category})` : ''}`).join('\n'),
    );
  }

  const prompt = `Write a friendly, concise weekly newsletter for "${siteName}". Output JSON with "subject" and "body" (HTML). The body should be warm, use <h2>, <p>, <ul> tags, and be ready to send.

Community activity this week:
${sections.join('\n\n')}`;

  const response = await callAI(provider, prompt, 2048);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);

  return {
    subject: parsed.subject || `${siteName} — Weekly Update`,
    body: parsed.body || '<p>This week in our community...</p>',
  };
}

// --- Event Recap ---

async function handleRecap(eventId) {
  const flag = await adminDb().from('site_config').select('value').eq('key', 'feature_ai_event_recaps').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ error: 'feature_ai_event_recaps disabled' }), { status: 403 });
  }

  if (!process.env.AI_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI_API_KEY not set' }), { status: 500 });
  }

  const events = await adminDb()
    .from('events')
    .select('id,title,description,starts_at,ends_at,location')
    .eq('id', eventId);
  if (!events.length) {
    return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });
  }
  const event = events[0];

  const endsAt = event.ends_at || event.starts_at;
  if (new Date(endsAt) > new Date()) {
    return new Response(JSON.stringify({ error: 'Event has not ended yet' }), { status: 400 });
  }

  const rsvps = await adminDb().from('event_rsvps').select('id').eq('event_id', eventId).eq('status', 'going');
  const attendeeCount = rsvps.length;
  const siteName = await getSiteName();
  const provider = process.env.AI_PROVIDER || 'openai';

  try {
    const eventDate = new Date(event.starts_at).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const prompt = `Write a brief, warm event recap for "${siteName}". Output JSON with "title" and "body" (HTML with <p> tags).

Event: ${event.title}
Date: ${eventDate}
Location: ${event.location || 'Not specified'}
Attendees: ${attendeeCount}
Description: ${(event.description || '').substring(0, 500)}`;

    const response = await callAI(provider, prompt, 1024);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);

    const recap = {
      title: parsed.title || `Recap: ${event.title}`,
      body: parsed.body || `<p>Thanks to everyone who attended ${event.title}!</p>`,
    };

    await adminDb()
      .from('announcements')
      .insert({
        title: recap.title,
        body: sanitizeRichHtmlServer(recap.body),
        is_pinned: false,
      });

    return new Response(JSON.stringify({ status: 'ok', title: recap.title }));
  } catch (e) {
    console.error('Recap generation failed:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// --- Shared helpers ---

// Only the platform (a schedule trigger, or the owner's `run402 functions runs
// create`) or an admin may run this. The gateway sets x-run402-trigger on the
// runs it starts and never forwards a caller's x-run402-* headers to a function.
async function authorizeRun(req, admin) {
  if (req.headers.get('x-run402-trigger')) return null;
  const user = await auth.user();
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!(await isActiveAdmin(admin, user))) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }
  return null;
}

// An active member with role admin (matched by user id, then email, as
// kychon-api resolves actors) or a project admin.
async function isActiveAdmin(admin, user) {
  if (isProjectAdmin(user)) return true;
  const member = await findMember(admin, user);
  return (member?.role === 'admin' || member?.role === 'owner') && member?.status === 'active';
}

function isProjectAdmin(user) {
  return (
    user.is_admin === true ||
    user.role === 'project_admin' ||
    user.app_metadata?.role === 'project_admin' ||
    user.app_metadata?.is_admin === true
  );
}

async function findMember(admin, user) {
  // run402-allow-user-filter: adminDb() bypasses RLS to map the actor to its member row
  const byUserId = await admin.from('members').select('role,status').eq('user_id', user.id).limit(1);
  let row = byUserId?.[0];
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!row && email) {
    const byEmail = await admin.from('members').select('role,status').eq('email', email).limit(1);
    row = byEmail?.[0];
  }
  if (!row) return null;
  return {
    role: String(row.role || 'member').toLowerCase(),
    status: String(row.status || 'pending').toLowerCase(),
  };
}

async function getSiteName() {
  const nameRow = await adminDb().from('site_config').select('value').eq('key', 'site_name').limit(1);
  return nameRow.length ? JSON.parse(JSON.stringify(nameRow[0].value)).replace(/^"|"$/g, '') : 'Our Community';
}

async function callAI(provider, prompt, maxTokens) {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.AI_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || '{}';
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '{}';
  }
}

// --- Rich-HTML sanitizer ---

// The AI's HTML is untrusted: it echoes member-written titles and posts, and a
// recap is published as a public announcement. Both bodies pass the same
// write-side allowlist sanitizer as kychon-api.js before they are stored.
// Functions deploy as single files, so this is a verbatim copy of the one in
// kychon-api.js (see the comment there for how it works); a unit test keeps
// the two identical.
const RICH_HTML_ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'sub',
  'sup',
  'mark',
  'small',
  'span',
  'div',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
]);
const RICH_HTML_VOID_TAGS = new Set(['br', 'hr', 'img']);
const RICH_HTML_DROP_WITH_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
  'select',
  'option',
  'svg',
  'math',
]);
const RICH_HTML_ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
};
const RICH_HTML_GLOBAL_ATTRS = new Set(['id', 'lang', 'dir']);
const RICH_HTML_SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
// Named references decoded inside attribute values. Anything else stays
// literal text (its `&` is escaped on output), so a browser never decodes a
// reference this check did not see.
const RICH_HTML_NAMED_REFERENCES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  Tab: '\t',
  NewLine: '\n',
  colon: ':',
  semi: ';',
  comma: ',',
  period: '.',
  sol: '/',
  bsol: '\\',
  num: '#',
  quest: '?',
  excl: '!',
  equals: '=',
  commat: '@',
  percnt: '%',
  plus: '+',
  lowbar: '_',
  lpar: '(',
  rpar: ')',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
};
// References a browser also decodes without the trailing semicolon.
const RICH_HTML_LEGACY_REFERENCES = new Set(['amp', 'lt', 'gt', 'quot', 'nbsp', 'copy', 'reg']);
const RICH_HTML_REFERENCE_RE = /&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[A-Za-z][A-Za-z0-9]*;?)/g;
const RICH_HTML_RAW_AMPERSAND_RE = /&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);)/gi;
const RICH_HTML_SPACE_RE = /[\t\n\f\r ]/;
const RICH_HTML_TAG_NAME_END_RE = /[\t\n\f\r />]/;
const RICH_HTML_ATTR_NAME_END_RE = /[\t\n\f\r />=]/;
const RICH_HTML_UNQUOTED_VALUE_END_RE = /[\t\n\f\r >]/;

function sanitizeRichHtmlServer(input) {
  if (input == null) return '';
  const html = String(input).replaceAll('\0', '');
  const out = [];
  const open = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      out.push(escapeRichHtmlText(html.slice(i)));
      break;
    }
    if (lt > i) out.push(escapeRichHtmlText(html.slice(i, lt)));
    i = readRichHtmlMarkup(html, lt, out, open);
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('');
}

// Consumes the markup starting at `<` (html[at]) and returns the index after it.
function readRichHtmlMarkup(html, at, out, open) {
  if (html.startsWith('<!--', at)) return skipRichHtmlPast(html, '-->', at + 4);
  const next = html[at + 1] ?? '';
  if (next === '!' || next === '?') return skipRichHtmlPast(html, '>', at + 2);
  const isEndTag = next === '/';
  const nameStart = isEndTag ? at + 2 : at + 1;
  if (!/[A-Za-z]/.test(html[nameStart] ?? '')) {
    if (!isEndTag) {
      out.push('&lt;');
      return at + 1;
    }
    // `</>` is ignored; `</` + anything else is a bogus comment up to `>`.
    return skipRichHtmlPast(html, '>', nameStart);
  }
  const tag = readRichHtmlTag(html, nameStart);
  // A tag cut off by the end of the input is dropped, as browsers do.
  if (!tag) return html.length;
  if (isEndTag) {
    closeRichHtmlTag(tag.name, open, out);
    return tag.end;
  }
  if (RICH_HTML_DROP_WITH_CONTENT_TAGS.has(tag.name)) {
    const selfClosingForeign = tag.selfClosing && (tag.name === 'svg' || tag.name === 'math');
    return selfClosingForeign ? tag.end : skipRichHtmlContainer(html, tag.name, tag.end);
  }
  if (RICH_HTML_ALLOWED_TAGS.has(tag.name)) {
    out.push(`<${tag.name}${renderRichHtmlAttributes(tag.name, tag.attributes)}>`);
    if (!RICH_HTML_VOID_TAGS.has(tag.name)) open.push(tag.name);
  }
  return tag.end;
}

// Reads a tag's name and attributes the way the HTML tokenizer does: `/` and
// whitespace separate attributes, quoted values may hold `>`, and the first
// of a repeated attribute wins. Returns null when the input ends mid-tag.
function readRichHtmlTag(html, nameStart) {
  let i = nameStart;
  while (i < html.length && !RICH_HTML_TAG_NAME_END_RE.test(html[i])) i += 1;
  const name = html.slice(nameStart, i).toLowerCase();
  const attributes = new Map();
  let selfClosing = false;
  while (i < html.length) {
    const ch = html[i];
    if (ch === '>') return { name, attributes, selfClosing, end: i + 1 };
    if (ch === '/') {
      selfClosing = html[i + 1] === '>';
      i += 1;
      continue;
    }
    if (RICH_HTML_SPACE_RE.test(ch)) {
      i += 1;
      continue;
    }
    const attr = readRichHtmlAttribute(html, i);
    if (!attr) return null;
    if (!attributes.has(attr.name)) attributes.set(attr.name, attr.value);
    i = attr.end;
  }
  return null;
}

function readRichHtmlAttribute(html, nameStart) {
  // The first character is part of the name even when it is `=`.
  let i = nameStart + 1;
  while (i < html.length && !RICH_HTML_ATTR_NAME_END_RE.test(html[i])) i += 1;
  const name = html.slice(nameStart, i).toLowerCase();
  let j = skipRichHtmlSpaces(html, i);
  if (html[j] !== '=') return { name, value: '', end: i };
  j = skipRichHtmlSpaces(html, j + 1);
  const quote = html[j];
  if (quote === '"' || quote === "'") {
    const close = html.indexOf(quote, j + 1);
    if (close < 0) return null;
    return { name, value: html.slice(j + 1, close), end: close + 1 };
  }
  const valueStart = j;
  while (j < html.length && !RICH_HTML_UNQUOTED_VALUE_END_RE.test(html[j])) j += 1;
  return { name, value: html.slice(valueStart, j), end: j };
}

function skipRichHtmlSpaces(html, from) {
  let i = from;
  while (i < html.length && RICH_HTML_SPACE_RE.test(html[i])) i += 1;
  return i;
}

function skipRichHtmlPast(html, marker, from) {
  const found = html.indexOf(marker, from);
  return found < 0 ? html.length : found + marker.length;
}

// Skips a dropped container's content through its matching end tag (or to
// the end of the input when it never closes).
function skipRichHtmlContainer(html, name, from) {
  const closeRe = new RegExp(`</${name}(?=[\\t\\n\\f\\r />]|$)`, 'gi');
  closeRe.lastIndex = from;
  const match = closeRe.exec(html);
  if (!match) return html.length;
  return skipRichHtmlPast(html, '>', match.index + match[0].length);
}

function closeRichHtmlTag(name, open, out) {
  const index = open.lastIndexOf(name);
  if (index < 0) return;
  while (open.length > index) out.push(`</${open.pop()}>`);
}

function renderRichHtmlAttributes(tag, attributes) {
  const allowed = RICH_HTML_ALLOWED_ATTRS[tag];
  const kept = new Map();
  for (const [name, raw] of attributes) {
    if (name.startsWith('on')) continue;
    if (!allowed?.has(name) && !RICH_HTML_GLOBAL_ATTRS.has(name)) continue;
    const value = decodeRichHtmlAttribute(raw);
    if (name === 'href' && !isSafeRichHtmlUrl(value, false)) continue;
    if (name === 'src' && !isSafeRichHtmlUrl(value, true)) continue;
    kept.set(name, value);
  }
  if (String(kept.get('target') ?? '').toLowerCase() === '_blank') {
    kept.set('rel', relWithNoopener(kept.get('rel') ?? ''));
  }
  let rendered = '';
  for (const [name, value] of kept) rendered += ` ${name}="${escapeRichHtmlAttribute(value)}"`;
  return rendered;
}

function relWithNoopener(rel) {
  const tokens = String(rel).split(/\s+/).filter(Boolean);
  const lower = new Set(tokens.map((token) => token.toLowerCase()));
  if (!lower.has('noopener')) tokens.push('noopener');
  if (!lower.has('noreferrer')) tokens.push('noreferrer');
  return tokens.join(' ');
}

function decodeRichHtmlAttribute(value) {
  return value.replace(RICH_HTML_REFERENCE_RE, (match, ref, offset) => {
    if (ref[0] === '#') {
      const hex = ref[1] === 'x' || ref[1] === 'X';
      const digits = ref.slice(hex ? 2 : 1).replace(/;$/, '');
      return richHtmlCodePoint(Number.parseInt(digits, hex ? 16 : 10));
    }
    if (ref.endsWith(';')) {
      const name = ref.slice(0, -1);
      return Object.hasOwn(RICH_HTML_NAMED_REFERENCES, name) ? RICH_HTML_NAMED_REFERENCES[name] : match;
    }
    // Inside an attribute a browser decodes a legacy reference without its
    // semicolon unless `=` follows it.
    if (RICH_HTML_LEGACY_REFERENCES.has(ref) && value[offset + match.length] !== '=') {
      return RICH_HTML_NAMED_REFERENCES[ref];
    }
    return match;
  });
}

function richHtmlCodePoint(codePoint) {
  if (!Number.isFinite(codePoint) || codePoint === 0 || codePoint > 0x10ffff) return '�';
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return '�';
  return String.fromCodePoint(codePoint);
}

function isSafeRichHtmlUrl(value, allowDataImage) {
  // Browsers drop tab and newline anywhere in a URL and controls or spaces
  // at its ends; removing them all reads the URL the most permissive way.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: C0 controls are what URL parsing strips.
  const compact = value.replace(/[\u0000-\u0020\u007f]+/g, '');
  if (!compact) return false;
  const colon = compact.indexOf(':');
  if (colon < 0) return true;
  const delimiter = compact.search(/[/?#]/);
  if (delimiter >= 0 && delimiter < colon) return true;
  if (RICH_HTML_SAFE_URL_SCHEMES.has(compact.slice(0, colon + 1).toLowerCase())) return true;
  return allowDataImage && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)/i.test(compact);
}

function escapeRichHtmlText(value) {
  return value.replace(RICH_HTML_RAW_AMPERSAND_RE, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRichHtmlAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
