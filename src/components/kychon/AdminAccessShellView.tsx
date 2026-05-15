import { LoaderCircle } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/kychon/ui';

interface AdminAccessShellViewProps {
  body: string;
  title: string;
}

export default function AdminAccessShellView({ body, title }: AdminAccessShellViewProps) {
  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
      data-admin-access-checking
      role="status"
      aria-live="polite"
    >
      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-primary" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{body}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
