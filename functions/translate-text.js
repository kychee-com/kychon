// On-demand translation of forum posts (the forum's "Translate" button).
// Caches results in content_translations table. Uses Run402's native AI translation helper.
//
// The forum calls this cross-origin with only the public anon key (the member's
// session cookie is host-only and reaches only /api/kychon), so callers are
// anonymous here. Each request is therefore bound to stored content: it names a
// forum post, its text must match the stored text, and the target language must
// be one the portal has enabled. Only stored posts are translated, each at most
// once per enabled language, so a caller cannot spend the translation quota on
// arbitrary text, read a cached translation of a post it cannot see, or plant a
// cached "translation" of its own text under someone else's post.
import { adminDb, ai } from '@run402/functions';

// content_type -> source table and the fields the forum offers to translate.
const TRANSLATABLE = new Map([
  ['forum_topic', { table: 'forum_topics', fields: ['title', 'body'] }],
  ['forum_reply', { table: 'forum_replies', fields: ['body'] }],
]);

// Longer posts are translated up to this many characters.
const MAX_TRANSLATE_CHARS = 5000;

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { text, target_lang, content_type, content_id, field } = body || {};
  if (typeof text !== 'string' || !text || typeof target_lang !== 'string' || !target_lang) {
    return new Response(JSON.stringify({ error: 'text and target_lang required' }), { status: 400 });
  }

  const source = TRANSLATABLE.get(content_type);
  const contentId = Number(content_id);
  if (!source?.fields.includes(field) || !Number.isInteger(contentId) || contentId <= 0) {
    return new Response(JSON.stringify({ error: 'content_type, content_id, and field must name a forum post' }), {
      status: 400,
    });
  }

  try {
    const admin = adminDb();
    const config = await readConfig(admin);
    if (config.get('feature_ai_translation') !== true) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_translation disabled' }));
    }

    // Use the enabled language's own spelling, so the cache key set stays bounded.
    const wanted = target_lang.toLowerCase();
    const language = enabledLanguages(config).find((lang) => lang.toLowerCase() === wanted);
    if (!language) {
      return new Response(JSON.stringify({ error: 'target_lang is not enabled on this portal' }), { status: 400 });
    }

    const rows = await admin.from(source.table).select(`id,${field}`).eq('id', contentId).limit(1);
    const stored = rows?.[0]?.[field];
    if (typeof stored !== 'string' || !stored) {
      return new Response(JSON.stringify({ error: 'Content not found' }), { status: 404 });
    }
    if (normalizeText(stored) !== normalizeText(text)) {
      return new Response(JSON.stringify({ error: 'text does not match the stored content' }), { status: 409 });
    }

    const cached = await admin
      .from('content_translations')
      .select('translated_text')
      .eq('content_type', content_type)
      .eq('content_id', contentId)
      .eq('language', language)
      .eq('field', field)
      .limit(1);
    if (cached.length > 0) {
      return new Response(JSON.stringify({ translated: cached[0].translated_text, cached: true }));
    }

    const context = `${content_type} on a community portal`;
    const result = await ai.translate(stored.substring(0, MAX_TRANSLATE_CHARS), language, { context });
    const translated = result?.text?.trim();
    if (!translated) {
      return new Response(JSON.stringify({ error: 'No translation returned' }), { status: 500 });
    }

    try {
      await admin.from('content_translations').insert({
        content_type,
        content_id: contentId,
        language,
        field,
        translated_text: translated,
      });
    } catch {
      // cache write failed (a concurrent request stored it first), not critical
    }

    return new Response(JSON.stringify({ translated }));
  } catch (e) {
    return new Response(JSON.stringify({ error: `Translation failed: ${e.message}` }), { status: 500 });
  }
};

async function readConfig(admin) {
  const rows = await admin.from('site_config').select('key,value');
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [row.key, parseConfigValue(row.value)]));
}

// site_config values are JSONB; some rows hold JSON-encoded text ('"en"', '["en","es"]').
function parseConfigValue(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// site_config.languages_enabled (or the legacy `languages`) lists the enabled language codes.
function enabledLanguages(config) {
  const value = config.get('languages_enabled') ?? config.get('languages');
  return Array.isArray(value) ? value.filter((lang) => typeof lang === 'string' && lang) : [];
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, '\n').trim();
}
