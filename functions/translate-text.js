// On-demand text translation for user-generated content (Twitter-style "Translate" button)
// Uses OpenAI API via OPENAI_API_KEY secret

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { text, target_lang } = body;
  if (!text || !target_lang) {
    return new Response(JSON.stringify({ error: 'text and target_lang required' }), { status: 400 });
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

    if (translated) {
      return new Response(JSON.stringify({ translated }));
    }
    return new Response(JSON.stringify({ error: 'No translation returned' }), { status: 500 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Translation failed: ' + e.message }), { status: 500 });
  }
};
