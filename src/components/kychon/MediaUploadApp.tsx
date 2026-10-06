// /media-upload: where an admin uploads an image an AI assistant asked for
// (media.requestUpload), for example a photo that is in their chat. The upload
// lands in the media library, where the assistant finds it with media.list.
import { Check, Upload } from 'lucide-react';
import { useState } from 'react';
import { MediaPicker, type MediaAssetRef } from '@/components/kychon/MediaPickerIsland';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kychon/ui';
import { t } from '@/lib/i18n';

export default function MediaUploadApp() {
  const [open, setOpen] = useState(false);
  const [uploaded, setUploaded] = useState<MediaAssetRef | null>(null);

  return (
    <Card data-media-upload>
      <CardHeader>
        <CardTitle>{t('media_upload.title')}</CardTitle>
        <CardDescription>{t('media_upload.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {t('media_upload.choose')}
        </Button>
        {uploaded ? (
          <p className="flex items-center gap-2 text-sm" data-media-upload-done>
            <Check className="h-4 w-4" aria-hidden="true" />
            {t('media_upload.done', { name: uploaded.metadata?.filename || uploaded.key.split('/').pop() || '' })}
          </p>
        ) : null}
        <MediaPicker
          open={open}
          onOpenChange={setOpen}
          onSelect={(ref) => {
            setUploaded(ref);
            setOpen(false);
          }}
        />
      </CardContent>
    </Card>
  );
}
