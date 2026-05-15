import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../..');
const page = readFileSync(join(root, 'src/pages/polls.astro'), 'utf8');
const app = readFileSync(join(root, 'src/components/kychon/PollsPageApp.tsx'), 'utf8');

describe('polls page source', () => {
  it('uses a shadcn React island instead of inline DOM scripting', () => {
    expect(page).toContain('<PollsPageApp client:load />');
    expect(page).not.toContain('<script>');
    expect(page).not.toContain('class="btn');
    expect(page).not.toContain('class="form-');
    expect(page).not.toContain('class="card');
    expect(page).not.toContain('poll-ui');
  });

  it('keeps poll loading, voting, create, close/reopen, and delete behavior in the island', () => {
    expect(app).toContain("getPolls('attached_to=is.null&order=is_open.desc,created_at.desc')");
    expect(app).toContain("post('poll_votes'");
    expect(app).toContain("post('polls'");
    expect(app).toContain('poll_create');
    expect(app).toContain('Close Poll');
    expect(app).toContain('Reopen Poll');
    expect(app).toContain('Delete poll?');
  });

  it('renders with shared shadcn primitives and without the legacy poll DOM helpers', () => {
    expect(app).toContain('Card');
    expect(app).toContain('Dialog');
    expect(app).toContain('Select');
    expect(app).toContain('Button');
    expect(app).not.toContain('renderPoll');
    expect(app).not.toContain('bindPollVoteListeners');
    expect(app).not.toContain('createPollForm');
    expect(app).not.toContain('dangerouslySetInnerHTML');
  });
});
