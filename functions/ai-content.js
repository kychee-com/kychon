// AI content generation — newsletter drafts + event recaps
// prototype-schedule: "0 9 * * 1" (requires hobby tier — prototype allows only 1 scheduled fn)
import { db } from 'run402-functions';

export default async (req) => {
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
  const flag = await db.from('site_config').select('value').eq('key', 'feature_ai_newsletter').limit(1);
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

    await db.from('newsletter_drafts').insert({
      subject: newsletter.subject,
      body: newsletter.body,
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
    db.from('members').select('display_name').gte('joined_at', since).eq('status', 'active'),
    db
      .from('events')
      .select('title,starts_at,location')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(5),
    db
      .from('announcements')
      .select('title,body')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5),
    db
      .from('forum_topics')
      .select('title,reply_count')
      .gte('created_at', since)
      .order('reply_count', { ascending: false })
      .limit(5),
    db.from('resources').select('title,category').gte('created_at', since).limit(5),
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
  const flag = await db.from('site_config').select('value').eq('key', 'feature_ai_event_recaps').limit(1);
  if (!flag.length || (flag[0].value !== true && flag[0].value !== 'true')) {
    return new Response(JSON.stringify({ error: 'feature_ai_event_recaps disabled' }), { status: 403 });
  }

  if (!process.env.AI_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI_API_KEY not set' }), { status: 500 });
  }

  const events = await db.from('events').select('id,title,description,starts_at,ends_at,location').eq('id', eventId);
  if (!events.length) {
    return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });
  }
  const event = events[0];

  const endsAt = event.ends_at || event.starts_at;
  if (new Date(endsAt) > new Date()) {
    return new Response(JSON.stringify({ error: 'Event has not ended yet' }), { status: 400 });
  }

  const rsvps = await db.from('event_rsvps').select('id').eq('event_id', eventId).eq('status', 'going');
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

    await db.from('announcements').insert({
      title: recap.title,
      body: recap.body,
      is_pinned: false,
    });

    return new Response(JSON.stringify({ status: 'ok', title: recap.title }));
  } catch (e) {
    console.error('Recap generation failed:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// --- Shared helpers ---

async function getSiteName() {
  const nameRow = await db.from('site_config').select('value').eq('key', 'site_name').limit(1);
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
