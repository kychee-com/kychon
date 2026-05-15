import type { CSSProperties } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@/components/kychon/ui';
import { StaticReactProbe } from './StaticReactProbe';

type TokenOverrideStyle = CSSProperties & {
  '--ky-color-border': string;
  '--ky-color-primary': string;
};

export default function UiTokensPageApp() {
  const tokenOverrideStyle: TokenOverrideStyle = {
    '--ky-color-border': '#a78bfa',
    '--ky-color-primary': '#7c3aed',
  };

  return (
    <section className="bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <StaticReactProbe />
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-normal">UI Tokens</h1>
          <p className="text-muted-foreground">Visual fixture for the Kychon token bridge and Tailwind v4 utility foundation.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Surface</CardTitle>
              <CardDescription>Background, foreground, card, muted foreground, border, and radius.</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button">Primary</Button>
              <Button type="button" variant="destructive">
                Destructive
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form</CardTitle>
            </CardHeader>
            <CardContent>
              <Input id="ui-token-input" name="ui-token-input" readOnly value="Tokenized input" />
            </CardContent>
          </Card>

          <Card style={tokenOverrideStyle}>
            <CardHeader>
              <CardTitle>Tenant Override</CardTitle>
              <CardDescription>This fixture overrides Kychon runtime tokens locally with CSS variables.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button">Tenant Primary</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
