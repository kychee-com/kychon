import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORUM_PAGE = resolve(process.cwd(), 'src/pages/forum.astro');
const FORUM_APP = resolve(process.cwd(), 'src/components/kychon/ForumPageApp.tsx');

describe('forum page source', () => {
  it('uses the shadcn React island instead of inline DOM rendering', async () => {
    const page = await readFile(FORUM_PAGE, 'utf8');

    expect(page).toContain('ForumPageApp');
    expect(page).toContain('client:load');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('<style');
    expect(page).not.toContain('id="forum-root"');
    expect(page).not.toContain('class="ky-container');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
  });

  it('keeps forum behavior in typed React state instead of string-built HTML', async () => {
    const app = await readFile(FORUM_APP, 'utf8');

    expect(app).toContain('@/components/kychon/ui');
    expect(app).toContain("post('forum_topics'");
    expect(app).toContain("post('forum_replies'");
    expect(app).toContain("post('poll_votes'");
    expect(app).toContain('fetchAttachedForumPoll');
    expect(app).toContain('showForumToast');
    expect(app).toContain('TranslateButton');
    expect(app).toContain('data-forum-page');
    expect(app).toContain('data-forum-category-card');
    expect(app).not.toContain('innerHTML');
    expect(app).not.toContain('insertAdjacentHTML');
    expect(app).not.toContain('document.createElement');
    expect(app).not.toContain('querySelector');
    expect(app).not.toContain('poll-ui');
    expect(app).not.toContain('class="card');
    expect(app).not.toContain('class="btn');
    expect(app).not.toContain('class="form-');
  });
});
