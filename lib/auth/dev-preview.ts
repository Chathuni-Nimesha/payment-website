import { isDevMailPreviewEnabled } from "@/lib/email/dev-mailbox";

export function withDevPreview<T extends Record<string, unknown>>(
  body: T,
  previewUrl?: string,
) {
  if (!isDevMailPreviewEnabled() || !previewUrl) {
    return body;
  }

  return { ...body, devUrl: previewUrl };
}
