// prototype-schedule: "*/15 * * * *" (requires hobby tier — prototype allows only 1 scheduled fn)
import { ai, db } from '@run402/functions';

export default async (_req) => {
  // Check if feature is enabled
  const flag = await db.from('site_config').select('value').eq('key', 'feature_ai_moderation').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'feature_ai_moderation disabled' }));
  }

  let moderated = 0;

  // Find last moderation timestamp
  const lastCheck = await db.sql('SELECT max(created_at) as last_at FROM moderation_log');
  const lastAt = (lastCheck.rows || lastCheck)[0]?.last_at || '1970-01-01T00:00:00Z';

  // Get new forum topics since last check
  const newTopics = await db
    .from('forum_topics')
    .select('id,title,body,author_id')
    .gt('created_at', lastAt)
    .eq('hidden', false);

  for (const topic of newTopics) {
    const result = await moderateContent(`${topic.title}\n\n${topic.body}`);
    if (result.confidence > 0.7 && result.flagged) {
      await db.from('forum_topics').update({ hidden: true }).eq('id', topic.id);
    }
    await db.from('moderation_log').insert({
      content_type: 'forum_topic',
      content_id: topic.id,
      action: result.action,
      reason: result.reason,
      confidence: result.confidence,
    });
    moderated++;
  }

  // Get new forum replies since last check
  const newReplies = await db
    .from('forum_replies')
    .select('id,body,author_id')
    .gt('created_at', lastAt)
    .eq('hidden', false);

  for (const reply of newReplies) {
    const result = await moderateContent(reply.body);
    if (result.confidence > 0.7 && result.flagged) {
      await db.from('forum_replies').update({ hidden: true }).eq('id', reply.id);
    }
    await db.from('moderation_log').insert({
      content_type: 'forum_reply',
      content_id: reply.id,
      action: result.action,
      reason: result.reason,
      confidence: result.confidence,
    });
    moderated++;
  }

  return new Response(JSON.stringify({ status: 'ok', moderated }));
};

async function moderateContent(text) {
  try {
    const result = await ai.moderate(text.substring(0, 10000));
    const scores = result.category_scores || {};
    const entries = Object.entries(scores);
    const maxEntry = entries.reduce((a, b) => (b[1] > a[1] ? b : a), ['unknown', 0]);
    const confidence = maxEntry[1];
    const reason = maxEntry[0];

    if (!result.flagged) {
      return { action: 'approved', confidence, reason, flagged: false };
    }
    if (confidence > 0.7) {
      return { action: 'hidden', confidence, reason, flagged: true };
    }
    return { action: 'flagged', confidence, reason, flagged: true };
  } catch (e) {
    console.warn('ai.moderate() failed:', e.message);
    return { action: 'approved', confidence: 0, reason: 'moderation unavailable', flagged: false };
  }
}
