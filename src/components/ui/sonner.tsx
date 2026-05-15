'use client';

import type * as React from 'react';
import { Toaster as Sonner } from 'sonner';

import { cn } from '@/lib/ui/cn';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ closeButton = true, richColors = true, toastOptions, className, ...props }: ToasterProps) {
  const classNames = toastOptions?.classNames;

  return (
    <Sonner
      closeButton={closeButton}
      richColors={richColors}
      className={className}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: cn('border-border bg-background text-foreground shadow-lg', classNames?.toast),
          description: cn('text-muted-foreground', classNames?.description),
          actionButton: cn('bg-primary text-primary-foreground', classNames?.actionButton),
          cancelButton: cn('bg-muted text-muted-foreground', classNames?.cancelButton),
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
export { Toaster };
