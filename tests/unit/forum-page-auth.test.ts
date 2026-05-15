import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORUM_APP = resolve(process.cwd(), 'src/components/kychon/ForumPageApp.tsx');

describe('forum page auth submission flow', () => {
  it('does not require a hydrated session member object before creating topics or replies', async () => {
    const source = await readFile(FORUM_APP, 'utf8');

    expect(source).not.toMatch(/if\s*\(!memberId\)/);
    expect(source).not.toMatch(/author_id:\s*memberId/);
    expect(source).not.toMatch(/author_name:\s*session/);
    expect(source).not.toMatch(/patch\(`forum_topics\?id=eq\.\$\{topicId\}`/);
    expect(source).toMatch(/post\('forum_replies',\s*{\s*body,\s*topic_id: topicId,/s);
  });

  it('uses app toasts instead of blocking browser alerts for forum actions', async () => {
    const source = await readFile(FORUM_APP, 'utf8');

    expect(source).not.toContain('alert(');
    expect(source).toContain('showForumToast');
  });
});
