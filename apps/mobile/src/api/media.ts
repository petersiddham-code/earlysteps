import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import type { MediaAssetView, MediaKind } from '@earlysteps/shared-types';
import { apiClient, ApiError, getAuthToken } from './client.js';
import { getApiBaseUrl } from './config.js';
import { isGuestChildId } from '../guest/guestStore.js';

/**
 * Media capture endpoints (issue #134, Phase 1). Upload goes through expo-file-system's
 * uploadAsync — a native background-capable transfer that streams the file from disk —
 * instead of the JSON fetch client, since captures (especially video) are far too big to
 * read into JS memory. Consent and tier are enforced server-side (403); callers should
 * treat failures as "not uploaded", never as a results error.
 */

export interface UploadMediaInput {
  childId: string;
  kind: MediaKind;
  /** Local file:// URI from expo-image-picker / expo-audio. */
  fileUri: string;
  mimeType: string;
}

export async function uploadMedia(
  input: UploadMediaInput,
): Promise<MediaAssetView | null> {
  // Guest/ephemeral child (issue #63): media is keyed by a server-side child record,
  // which a guest session deliberately never creates — same reasoning as every other
  // premium endpoint in api/analysis.ts. (The entry point is premium-gated anyway.)
  if (isGuestChildId(input.childId)) return null;

  const token = getAuthToken();
  const result = await uploadAsync(
    `${getApiBaseUrl()}/children/${input.childId}/media`,
    input.fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: input.mimeType,
      parameters: { kind: input.kind, capturedAt: new Date().toISOString() },
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    },
  );

  let body: unknown;
  try {
    body = JSON.parse(result.body);
  } catch {
    body = undefined;
  }
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, body as ConstructorParameters<typeof ApiError>[1]);
  }
  return body as MediaAssetView;
}

/** The child's stored (non-deleted) media, newest first. */
export function listMedia(childId: string): Promise<MediaAssetView[]> {
  if (isGuestChildId(childId)) return Promise.resolve([]);
  return apiClient.get<MediaAssetView[]>(`/children/${childId}/media`);
}

/** Parent-initiated delete-now — real server-side deletion, ahead of the 90-day sweep. */
export function deleteMedia(childId: string, mediaId: string): Promise<void> {
  if (isGuestChildId(childId)) return Promise.resolve();
  return apiClient.delete(`/children/${childId}/media/${mediaId}`);
}
