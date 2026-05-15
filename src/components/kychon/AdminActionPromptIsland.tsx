'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button, Card, CardContent } from '@/components/kychon/ui';
import {
  ADMIN_ACTION_PROMPT_ACTIVATE,
  ADMIN_ACTION_PROMPT_DISMISS,
  ADMIN_ACTION_PROMPT_SHOW,
  type AdminActionPromptDetail,
  type AdminActionPromptIdDetail,
} from '@/lib/admin-action-prompts';

let root: Root | null = null;

function dispatchPromptEvent(eventName: string, id: string) {
  window.dispatchEvent(new CustomEvent<AdminActionPromptIdDetail>(eventName, { detail: { id } }));
}

function AdminActionPromptIsland() {
  const [prompt, setPrompt] = useState<AdminActionPromptDetail | null>(null);

  useEffect(() => {
    const onShow = ((event: CustomEvent<AdminActionPromptDetail>) => {
      setPrompt(event.detail);
    }) as EventListener;
    const onDismiss = ((event: CustomEvent<AdminActionPromptIdDetail>) => {
      setPrompt((current) => (current && current.id === event.detail.id ? null : current));
    }) as EventListener;

    window.addEventListener(ADMIN_ACTION_PROMPT_SHOW, onShow);
    window.addEventListener(ADMIN_ACTION_PROMPT_DISMISS, onDismiss);
    return () => {
      window.removeEventListener(ADMIN_ACTION_PROMPT_SHOW, onShow);
      window.removeEventListener(ADMIN_ACTION_PROMPT_DISMISS, onDismiss);
    };
  }, []);

  useEffect(() => {
    if (!prompt?.duration) return undefined;
    const timeout = window.setTimeout(() => {
      dispatchPromptEvent(ADMIN_ACTION_PROMPT_DISMISS, prompt.id);
    }, prompt.duration);
    return () => window.clearTimeout(timeout);
  }, [prompt]);

  if (!prompt) return null;

  return (
    <Card
      className="fixed z-[9999] max-w-[min(22rem,calc(100vw-1rem))] border-border bg-popover text-popover-foreground shadow-lg"
      role="status"
      style={{ top: prompt.top, left: prompt.left }}
    >
      <CardContent className="flex items-center gap-2 p-2 text-sm">
        <span className="min-w-0 flex-1">{prompt.message}</span>
        <Button
          size="sm"
          type="button"
          onClick={() => {
            dispatchPromptEvent(ADMIN_ACTION_PROMPT_ACTIVATE, prompt.id);
            setPrompt(null);
          }}
        >
          {prompt.actionLabel}
        </Button>
        <Button
          aria-label={prompt.dismissLabel || 'Dismiss'}
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => dispatchPromptEvent(ADMIN_ACTION_PROMPT_DISMISS, prompt.id)}
        >
          <X aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function mountAdminActionPromptIsland(element: HTMLElement): void {
  if (root) return;
  root = createRoot(element);
  root.render(<AdminActionPromptIsland />);
}
