export interface ActivityEntry {
  id?: string | number;
  member_id?: string | number | null;
  action?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface ActivityMember {
  id?: string | number;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export function canReadActivityFeed(session: any, role: string | null | undefined): boolean {
  const member = session?.user?.member;
  return (
    role === 'admin' ||
    role === 'member' ||
    member?.status === 'active' ||
    (!member?.status && !!member?.id) ||
    !!session?.user
  );
}

export function activityMemberName(member: ActivityMember | null | undefined): string {
  return member?.display_name || member?.email || 'Former member';
}

export function activityInitial(name: string): string {
  return (name.trim()[0] || '?').toUpperCase();
}

export function activityText(
  action: string | null | undefined,
  name: string,
  metadata: Record<string, any> | null | undefined,
): string {
  const meta = metadata || {};

  switch (action) {
    case 'member_join':
      return `${name} joined the community`;
    case 'announcement':
      return `${name} posted an announcement: ${meta.title || ''}`;
    case 'rsvp':
      return `${name} is going to ${meta.event_title || 'an event'}`;
    case 'resource_upload':
      return `${name} shared a resource: ${meta.title || ''}`;
    case 'forum_post':
      return `${name} started a discussion: ${meta.title || ''}`;
    case 'forum_reply':
      return `${name} replied to a discussion`;
    case 'poll_vote':
      return `${name} voted in a poll`;
    case 'reaction':
      return `${name} reacted to ${meta.content_type || 'a post'}`;
    default:
      return `${name} was active`;
  }
}

export function formatActivityTime(iso: string, nowMs = Date.now()): string {
  const seconds = Math.floor((nowMs - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
