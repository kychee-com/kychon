import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { signedInJoinDestination } from '../../src/components/kychon/JoinPageApp';

const SOURCE = readFileSync('src/components/kychon/JoinPageApp.tsx', 'utf8');

describe('JoinPageApp', () => {
  it('routes signed-in admins to admin tools and members to their profile', () => {
    expect(signedInJoinDestination('admin')).toEqual({
      href: '/admin',
      label: 'Open admin dashboard',
    });
    expect(signedInJoinDestination('member')).toEqual({
      href: '/profile',
      label: 'View profile',
    });
    expect(signedInJoinDestination(null)).toEqual({
      href: '/profile',
      label: 'View profile',
    });
  });

  it('shows signed-in users a stable page instead of redirecting them away from join', () => {
    expect(SOURCE).toContain('Already Signed In');
    expect(SOURCE).toContain('signedIn === null');
    expect(SOURCE).toContain('refreshMemberRecord');
    expect(SOURCE).not.toContain("window.location.href = '/'");
  });
});
