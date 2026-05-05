// On-demand text translation for user-generated content (Twitter-style "Translate" button)
// Caches results in content_translations table. Uses Run402's native AI translation helper.
import { adminDb, ai } from '@run402/functions';

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { text, target_lang, content_type, content_id, field } = body;
  if (!text || !target_lang) {
    return new Response(JSON.stringify({ error: 'text and target_lang required' }), { status: 400 });
  }

  const flag = await adminDb().from('site_config').select('value').eq('key', 'feature_ai_translation').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_translation disabled' }));
  }

  // Check cache first (if content_type/content_id/field provided)
  if (content_type && content_id && field) {
    try {
      const cached = await adminDb()
        .from('content_translations')
        .select('translated_text')
        .eq('content_type', content_type)
        .eq('content_id', content_id)
        .eq('language', target_lang)
        .eq('field', field)
        .limit(1);
      if (cached.length > 0) {
        return new Response(JSON.stringify({ translated: cached[0].translated_text, cached: true }));
      }
    } catch {
      // cache lookup failed, proceed to translate
    }
  }

  const trimmed = text.substring(0, 5000);
  const context = content_type ? `${content_type} on a community portal` : 'forum post on a community portal';

  try {
    const result = await ai.translate(trimmed, target_lang, { context });
    const translated = result?.text?.trim();

    if (!translated) {
      return new Response(JSON.stringify({ error: 'No translation returned' }), { status: 500 });
    }

    // Store in cache (if content_type/content_id/field provided)
    if (content_type && content_id && field) {
      try {
        await adminDb()
          .from('content_translations')
          .insert({
            content_type,
            content_id: Number(content_id),
            language: target_lang,
            field,
            translated_text: translated,
          });
      } catch {
        // cache write failed (maybe duplicate), not critical
      }
    }

    return new Response(JSON.stringify({ translated }));
  } catch (e) {
    return new Response(JSON.stringify({ error: `Translation failed: ${e.message}` }), { status: 500 });
  }
};
