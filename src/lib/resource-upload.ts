// Resource files (PDFs, documents, images, videos) attached on the Resources
// page. Every browser upload goes through functions/upload-asset.js, which
// writes under the `assets/` namespace and admits active admins and owners
// only — the same role that may create a resource (`resources.upload`).
// The `resource-` file-name prefix keeps resource files recognizable among
// the media library's other assets.
import { safeStorageName, uploadFileContentAddressed } from './storage-upload';

export const RESOURCE_FILE_PREFIX = 'resource-';

export async function uploadResourceFile(file: File, authToken?: string): Promise<string> {
  const { url } = await uploadFileContentAddressed(file, {
    keyPrefix: 'assets',
    keyName: `${RESOURCE_FILE_PREFIX}${safeStorageName(file.name)}`,
    authToken,
  });
  return url;
}
