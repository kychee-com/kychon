// schedule: none (triggered by client after content publish)
import { db, getUser } from '@run402/functions';

export default async (req) => {
  const user = await getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if feature is enabled
  const flag = await db.from('site_config').select('value').eq('key', 'feature_ai_translation').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_translation disabled' }));
  }

  if (!process.env.AI_API_KEY) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'AI_API_KEY not set' }));
  }

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 }); }

  const { content_type, content_id } = body;
  if (!content_type || !content_id) {
    return new Response(JSON.stringify({ error: 'content_type and content_id required' }), { status: 400 });
  }

  // Get configured languages from brand.json (stored in site or fetched)
  // For now, read from a site_config key or default
  let languages = ['en'];
  try {
    const brandRes = await fetch('https://api.run402.com/rest/v1/site_config?key=eq.languages&select=value', {
      headers: { Authorization: 'Bearer ' + process.env.RUN402_SERVICE_KEY },
    });
    // Fallback: just use common languages if not configured
  } catch {}

  // Read the content
  let content = {};
  if (content_type === 'announcement') {
    const rows = await db.from('announcements').select('title,body').eq('id', content_id).limit(1);
    if (rows.length > 0) content = rows[0];
  } else if (content_type === 'event') {
    const rows = await db.from('events').select('title,description').eq('id', content_id).limit(1);
    if (rows.length > 0) content = { title: rows[0].title, body: rows[0].description };
  } else if (content_type === 'page') {
    const rows = await db.from('pages').select('title,content').eq('id', content_id).limit(1);
    if (rows.length > 0) content = { title: rows[0].title, body: rows[0].content };
  }

  if (!content.title) {
    return new Response(JSON.stringify({ error: 'Content not found' }), { status: 404 });
  }

  const provider = process.env.AI_PROVIDER || 'openai';
  const targetLangs = (body.languages || ['pt', 'es']).filter(l => l !== 'en');
  let translated = 0;

  for (const lang of targetLangs) {
    for (const field of ['title', 'body']) {
      if (!content[field]) continue;
      const translation = await translateText(provider, content[field], lang);
      if (translation) {
        // Upsert into content_translations
        const existing = await db.from('content_translations')
          .select('id')
          .eq('content_type', content_type)
          .eq('content_id', content_id)
          .eq('language', lang)
          .eq('field', field)
          .limit(1);

        if (existing.length > 0) {
          await db.from('content_translations')
            .update({ translated_text: translation })
            .eq('id', existing[0].id);
        } else {
          await db.from('content_translations').insert({
            content_type,
            content_id,
            language: lang,
            field,
            translated_text: translation,
          });
        }
        translated++;
      }
    }
  }

  return new Response(JSON.stringify({ status: 'ok', translated }));
};

async function translateText(provider, text, targetLang) {
  const prompt = `Translate the following text to ${targetLang}. Return only the translation, no explanation.\n\n${text.substring(0, 2000)}`;

  try {
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
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text || null;
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + process.env.AI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    }
  } catch (e) {
    console.warn('Translation failed:', e.message);
    return null;
  }
}
