// "Manage with ChatGPT" (admin settings) / "Use from ChatGPT" (profile): the
// portal's AI connector URL, how to add it in ChatGPT, and what to ask. The
// setup steps name only assistants verified end to end against a portal.
import { Check, Copy } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kychon/ui';
import { connectorMcpUrl } from '@/lib/connector-url';
import { t } from '@/lib/i18n';

/** site_config flag admins use to turn AI connectors off. Missing means on. */
export const CONNECTOR_FLAG = 'feature_ai_connector';

export function connectorEnabled(value: unknown): boolean {
  return value !== false && value !== 'false';
}

const EXAMPLES = {
  admin: ['connector.example_admin_1', 'connector.example_admin_2', 'connector.example_admin_3', 'connector.example_admin_4'],
  member: ['connector.example_member_1', 'connector.example_member_2', 'connector.example_member_3'],
} as const;

export interface AiConnectorCardProps {
  audience: 'admin' | 'member';
  /** Admin settings only: the on/off switch. */
  toggle?: ReactNode;
}

export function AiConnectorCard({ audience, toggle }: AiConnectorCardProps) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(connectorMcpUrl(window.location.origin));
  }, []);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card data-ai-connector={audience}>
      <CardHeader>
        <CardTitle>{t(audience === 'admin' ? 'connector.admin_title' : 'connector.member_title')}</CardTitle>
        <CardDescription>{t('connector.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {toggle}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('connector.url_label')}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-sm" data-ai-connector-url>
              {url}
            </code>
            <Button type="button" variant="outline" size="sm" disabled={!url} onClick={() => void copyUrl()}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? t('connector.copied') : t('connector.copy')}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('connector.steps_title')}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t('connector.step_settings')}</li>
            <li>{t('connector.step_create')}</li>
            <li>{t('connector.step_sign_in')}</li>
          </ol>
          <p className="text-sm text-muted-foreground">{t('connector.plans_note')}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('connector.examples_title')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {EXAMPLES[audience].map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
