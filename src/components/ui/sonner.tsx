'use client';

import type * as React from 'react';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ closeButton = true, richColors = true, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      closeButton={closeButton}
      richColors={richColors}
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            'group/ky-toast ky-toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-lg',
          description: 'group-[.ky-toast]:text-muted-foreground',
          actionButton: 'group-[.ky-toast]:bg-primary group-[.ky-toast]:text-primary-foreground',
          cancelButton: 'group-[.ky-toast]:bg-muted group-[.ky-toast]:text-muted-foreground',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
export { Toaster };
