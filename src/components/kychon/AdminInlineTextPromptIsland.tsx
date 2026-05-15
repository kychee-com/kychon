'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/kychon/ui';

interface AdminInlineTextPromptOptions {
  value: string;
}

type AdminInlineTextPromptRequest = AdminInlineTextPromptOptions & {
  resolve: (value: string | null) => void;
};

let root: Root | null = null;
let rootElement: HTMLElement | null = null;
let promptRequestHandler: ((request: AdminInlineTextPromptRequest) => void) | null = null;
let queuedRequest: AdminInlineTextPromptRequest | null = null;

function AdminInlineTextPromptIsland() {
  const inputId = useId();
  const activeRequest = useRef<AdminInlineTextPromptRequest | null>(null);
  const [prompt, setPrompt] = useState<AdminInlineTextPromptRequest | null>(null);
  const [value, setValue] = useState('');

  const settle = useCallback((nextValue: string | null) => {
    const current = activeRequest.current;
    if (!current) return;
    activeRequest.current = null;
    current.resolve(nextValue);
    setPrompt(null);
  }, []);

  useEffect(() => {
    const handler = (request: AdminInlineTextPromptRequest) => {
      activeRequest.current?.resolve(null);
      activeRequest.current = request;
      setValue(request.value);
      setPrompt(request);
    };
    promptRequestHandler = handler;
    if (queuedRequest) {
      const request = queuedRequest;
      queuedRequest = null;
      handler(request);
    }
    return () => {
      if (promptRequestHandler === handler) promptRequestHandler = null;
      activeRequest.current?.resolve(null);
      activeRequest.current = null;
    };
  }, []);

  return (
    <Dialog open={prompt !== null} onOpenChange={(open) => !open && settle(null)}>
      <DialogContent className="sm:max-w-md" data-admin-inline-text-prompt>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            settle(value.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit Text</DialogTitle>
            <DialogDescription>Update the selected text.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Text</Label>
            <Input
              id={inputId}
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => settle(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={prompt ? value.trim() === prompt.value : true}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function mountAdminInlineTextPromptIsland(element: HTMLElement): void {
  if (root && rootElement === element) return;
  if (root) root.unmount();
  rootElement = element;
  root = createRoot(element);
  root.render(<AdminInlineTextPromptIsland />);
}

export function showAdminInlineTextPrompt(options: AdminInlineTextPromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const request: AdminInlineTextPromptRequest = { ...options, resolve };
    if (promptRequestHandler) {
      promptRequestHandler(request);
      return;
    }
    queuedRequest?.resolve(null);
    queuedRequest = request;
  });
}
