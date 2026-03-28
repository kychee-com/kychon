// schedule: "*/15 * * * *"
import { db } from '@run402/functions';

export default async (req) => {
  // Check if feature is enabled
  const flag = await db.from('site_config').select('value').eq('key', 'feature_ai_moderation').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_moderation disabled' }));
  }

  if (!process.env.AI_API_KEY) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'AI_API_KEY not set' }));
  }

  const provider = process.env.AI_PROVIDER || 'openai';
  let moderated = 0;

  // Find last moderation timestamp
  const lastCheck = await db.sql(
    "SELECT max(created_at) as last_at FROM moderation_log"
  );
  const lastAt = (lastCheck.rows || lastCheck)[0]?.last_at || '1970-01-01T00:00:00Z';

  // Get new forum topics since last check
  const newTopics = await db.from('forum_topics')
    .select('id,title,body,author_id')
    .gt('created_at', lastAt)
    .eq('hidden', false);

  for (const topic of newTopics) {
    const result = await classifyContent(provider, topic.title + '\n\n' + topic.body);
    const action = result.confidence > 0.7 ? 'flagged' : (result.confidence > 0.3 ? 'flagged' : 'approved');

    if (result.confidence > 0.7) {
      // Auto-hide
      await db.from('forum_topics').update({ hidden: true }).eq('id', topic.id);
    }

    await db.from('moderation_log').insert({
      content_type: 'forum_topic',
      content_id: topic.id,
      action,
      reason: result.reason,
      confidence: result.confidence,
    });
    moderated++;
  }

  // Get new forum replies since last check
  const newReplies = await db.from('forum_replies')
    .select('id,body,author_id')
    .gt('created_at', lastAt)
    .eq('hidden', false);

  for (const reply of newReplies) {
    const result = await classifyContent(provider, reply.body);
    const action = result.confidence > 0.7 ? 'flagged' : (result.confidence > 0.3 ? 'flagged' : 'approved');

    if (result.confidence > 0.7) {
      await db.from('forum_replies').update({ hidden: true }).eq('id', reply.id);
    }

    await db.from('moderation_log').insert({
      content_type: 'forum_reply',
      content_id: reply.id,
      action,
      reason: result.reason,
      confidence: result.confidence,
    });
    moderated++;
  }

  return new Response(JSON.stringify({ status: 'ok', moderated }));
};

async function classifyContent(provider, text) {
  const prompt = `Classify this forum post for content moderation. Respond with JSON: {"classification": "spam|toxic|off_topic|appropriate", "confidence": 0.0-1.0, "reason": "brief explanation"}\n\nPost:\n${text.substring(0, 1000)}`;

  try {
    let response;
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
          max_tokens: 256,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      response = data.content?.[0]?.text || '{}';
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
          max_tokens: 256,
        }),
      });
      const data = await res.json();
      response = data.choices?.[0]?.message?.content || '{}';
    }

    const parsed = JSON.parse(response);
    return {
      classification: parsed.classification || 'appropriate',
      confidence: parsed.classification === 'appropriate' ? 0 : (parsed.confidence || 0.5),
      reason: parsed.reason || 'No reason provided',
    };
  } catch (e) {
    console.warn('AI classification failed:', e.message);
    return { classification: 'appropriate', confidence: 0, reason: 'AI unavailable' };
  }
}
