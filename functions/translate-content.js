// schedule: none (triggered by client after content publish)
import { ai, db, getUser } from 'run402-functions';

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

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { content_type, content_id } = body;
  if (!content_type || !content_id) {
    return new Response(JSON.stringify({ error: 'content_type and content_id required' }), { status: 400 });
  }

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

  const targetLangs = (body.languages || ['pt', 'es']).filter((l) => l !== 'en');
  let translated = 0;
  const context = `${content_type} on a community portal`;

  for (const lang of targetLangs) {
    for (const field of ['title', 'body']) {
      if (!content[field]) continue;
      try {
        const result = await ai.translate(content[field].substring(0, 10000), lang, { context });
        if (result.text) {
          // Upsert into content_translations
          const existing = await db
            .from('content_translations')
            .select('id')
            .eq('content_type', content_type)
            .eq('content_id', content_id)
            .eq('language', lang)
            .eq('field', field)
            .limit(1);

          if (existing.length > 0) {
            await db.from('content_translations').update({ translated_text: result.text }).eq('id', existing[0].id);
          } else {
            await db.from('content_translations').insert({
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
