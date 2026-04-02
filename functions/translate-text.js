// On-demand text translation for user-generated content (Twitter-style "Translate" button)
// Caches results in content_translations table. Uses OpenAI API via OPENAI_API_KEY secret.
import { db } from 'run402-functions';

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

  // Check cache first (if content_type/content_id/field provided)
  if (content_type && content_id && field) {
    try {
      const cached = await db
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });
  }

  const trimmed = text.substring(0, 5000);
  const langNames = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German' };
  const langName = langNames[target_lang] || target_lang;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `Translate the following text to ${langName}. Return only the translation, no explanations. Preserve the original tone and meaning. This is a community forum post.` },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();

    if (!translated) {
      return new Response(JSON.stringify({ error: 'No translation returned' }), { status: 500 });
    }

    // Store in cache (if content_type/content_id/field provided)
    if (content_type && content_id && field) {
      try {
        await db.from('content_translations').insert({
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
    return new Response(JSON.stringify({ error: 'Translation failed: ' + e.message }), { status: 500 });
  }
};
