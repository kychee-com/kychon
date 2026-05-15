import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Avatar, AvatarFallback, AvatarImage, Card, CardContent } from '@/components/kychon/ui';
import { get } from '@/lib/api';
import {
  activityInitial,
  activityMemberName,
  activityText,
  canReadActivityFeed,
  formatActivityTime,
  type ActivityEntry,
  type ActivityMember,
} from '@/lib/activity-feed';
import { getSession } from '@/lib/auth';

interface ActivityFeedProps {
  limit: number;
  role: string | null;
}

interface LoadedActivityEntry extends ActivityEntry {
  member: ActivityMember | null;
}

type ActivityState =
  | { status: 'loading' }
  | { status: 'member-only' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'ready'; entries: LoadedActivityEntry[] };

const roots = new WeakMap<HTMLElement, Root>();

function readSession(): any {
  try {
    return getSession();
  } catch {
    return null;
  }
}

async function loadActivity(limit: number): Promise<LoadedActivityEntry[]> {
  const entries = await get(`activity_log?order=created_at.desc&limit=${limit}`) as ActivityEntry[];
  const memberIds = Array.from(new Set(entries.map((entry) => entry.member_id).filter(Boolean)));
  const membersMap = new Map<string, ActivityMember>();

  if (memberIds.length > 0) {
    const members = await get(`members?id=in.(${memberIds.join(',')})`) as ActivityMember[];
    for (const member of members) {
      if (member.id != null) membersMap.set(String(member.id), member);
    }
  }

  return entries.map((entry) => ({
    ...entry,
    member: entry.member_id == null ? null : membersMap.get(String(entry.member_id)) || null,
  }));
}

function ActivityFeedIsland({ limit, role }: ActivityFeedProps) {
  const [state, setState] = React.useState<ActivityState>({ status: 'loading' });

  React.useEffect(() => {
    let ignore = false;

    async function refresh(): Promise<void> {
      const session = readSession();
      if (!canReadActivityFeed(session, role)) {
        if (!ignore) setState({ status: 'member-only' });
        return;
      }

      if (!ignore) setState({ status: 'loading' });

      try {
        const entries = await loadActivity(limit);
        if (ignore) return;
        setState(entries.length > 0 ? { status: 'ready', entries } : { status: 'empty' });
      } catch {
        if (!ignore) setState({ status: 'error' });
      }
    }

    void refresh();
    document.addEventListener('wl-auth-changed', refresh);
    return () => {
      ignore = true;
      document.removeEventListener('wl-auth-changed', refresh);
    };
  }, [limit, role]);

  return (
    <div className="grid max-w-2xl gap-3" id="activity-feed" data-activity-feed>
      <ActivityContent state={state} />
    </div>
  );
}

function ActivityContent({ state }: { state: ActivityState }) {
  if (state.status === 'loading') {
    return (
      <Card aria-label="Loading recent activity">
        <CardContent className="space-y-3 p-4">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'member-only') {
    return <p className="text-sm text-muted-foreground">Sign in as a member to see recent activity.</p>;
  }

  if (state.status === 'empty') {
    return <p className="text-sm text-muted-foreground">No recent activity yet.</p>;
  }

  if (state.status === 'error') {
    return <p className="text-sm text-muted-foreground">Could not load activity.</p>;
  }

  return state.entries.map((entry) => <ActivityEntryCard entry={entry} key={entry.id ?? entry.created_at} />);
}

function ActivityEntryCard({ entry }: { entry: LoadedActivityEntry }) {
  const name = activityMemberName(entry.member);
  const text = activityText(entry.action, name, entry.metadata);

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <Avatar className="h-9 w-9">
          {entry.member?.avatar_url && <AvatarImage src={entry.member.avatar_url} alt="" />}
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {activityInitial(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 text-foreground">{text}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatActivityTime(entry.created_at)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function mountActivityFeedIsland(element: HTMLElement, props: ActivityFeedProps): void {
  let root = roots.get(element);
  if (!root) {
    root = createRoot(element);
    roots.set(element, root);
  }
  root.render(<ActivityFeedIsland {...props} />);
}
