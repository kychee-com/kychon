// schedule: none (triggered by an admin after content publish)
import { adminDb, ai, auth } from '@run402/functions';

export default async (req) => {
  const user = await auth.user();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = adminDb();

  // Translating spends the project's metered AI translation quota and
  // overwrites stored translations, so only an admin may run it: an active
  // member with role admin (matched by user id, then email, as kychon-api
  // resolves actors) or a project admin. Anyone can self-register a Run402
  // user through /join, so being signed in is not enough.
  if (!(await isActiveAdmin(admin, user))) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403 });
  }

  const config = await readConfig(admin);
  if (config.get('feature_ai_translation') !== true) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_translation disabled' }));
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { content_type, content_id } = body || {};
  if (!content_type || !content_id) {
    return new Response(JSON.stringify({ error: 'content_type and content_id required' }), { status: 400 });
  }

  // Read the content
  let content = {};
  if (content_type === 'announcement') {
    const rows = await admin.from('announcements').select('title,body').eq('id', content_id).limit(1);
    if (rows.length > 0) content = rows[0];
  } else if (content_type === 'event') {
    const rows = await admin.from('events').select('title,description').eq('id', content_id).limit(1);
    if (rows.length > 0) content = { title: rows[0].title, body: rows[0].description };
  } else if (content_type === 'page') {
    const rows = await admin.from('pages').select('title,content').eq('id', content_id).limit(1);
    if (rows.length > 0) content = { title: rows[0].title, body: rows[0].content };
  }

  if (!content.title) {
    return new Response(JSON.stringify({ error: 'Content not found' }), { status: 404 });
  }

  // Translate into the portal's enabled languages other than the default one.
  // A caller-supplied `languages` list can only narrow that set.
  const configuredDefault = config.get('default_language');
  const defaultLanguage = (
    typeof configuredDefault === 'string' && configuredDefault ? configuredDefault : 'en'
  ).toLowerCase();
  const requested = Array.isArray(body.languages) ? body.languages.map((lang) => String(lang).toLowerCase()) : null;
  const targetLangs = enabledLanguages(config).filter(
    (lang) => lang.toLowerCase() !== defaultLanguage && (!requested || requested.includes(lang.toLowerCase())),
  );
  let translated = 0;
  const context = `${content_type} on a community portal`;

  for (const lang of targetLangs) {
    for (const field of ['title', 'body']) {
      if (!content[field]) continue;
      try {
        const result = await ai.translate(content[field].substring(0, 10000), lang, { context });
        if (result.text) {
          // Upsert into content_translations
          const existing = await admin
            .from('content_translations')
            .select('id')
            .eq('content_type', content_type)
            .eq('content_id', content_id)
            .eq('language', lang)
            .eq('field', field)
            .limit(1);

          if (existing.length > 0) {
            await admin.from('content_translations').update({ translated_text: result.text }).eq('id', existing[0].id);
          } else {
            await admin.from('content_translations').insert({
              content_type,
              content_id,
              language: lang,
              field,
              translated_text: result.text,
            });
          }
          translated++;
        }
      } catch (e) {
        console.warn(`Translation to ${lang} failed for ${field}:`, e.message);
        // Continue with next field — partial success is fine
      }
    }
  }

  return new Response(JSON.stringify({ status: translated > 0 ? 'ok' : 'skipped', translated }));
};

async function isActiveAdmin(admin, user) {
  if (isProjectAdmin(user)) return true;
  const member = await findMember(admin, user);
  return member?.role === 'admin' && member?.status === 'active';
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
