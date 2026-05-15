import { Plus } from 'lucide-react';
import { Button } from '@/components/kychon/ui';

type AdminZone = 'header' | 'main' | 'footer';

interface AdminZoneAddButtonProps {
  zone: AdminZone;
}

export default function AdminZoneAddButton({ zone }: AdminZoneAddButtonProps) {
  return (
    <Button
      className="mx-auto my-2 hidden w-fit border-dashed bg-background/90 text-muted-foreground shadow-sm hover:text-primary [body.admin_&]:!flex"
      data-admin-zone-add-button=""
      data-zone-add={zone}
      size="sm"
      type="button"
      variant="outline"
    >
      <Plus aria-hidden="true" />
      Add to {zone}
    </Button>
  );
}
