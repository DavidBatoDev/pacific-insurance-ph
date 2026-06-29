import "server-only";

import { getSupabaseAdmin } from "./admin";

/** The private Storage bucket holding all uploaded documents. */
export const DOCUMENTS_BUCKET = "documents";

/** Upload an object to the documents bucket. Returns the stored path. */
export async function uploadObject(
  path: string,
  body: Buffer | Uint8Array | Blob | ArrayBuffer,
  contentType?: string,
): Promise<string> {
  const { error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(path, body, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/** Create a short-lived signed URL for downloading a private object. */
export async function createSignedUrl(path: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

/** Remove an object from the documents bucket. */
export async function removeObject(path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) throw new Error(`Storage remove failed: ${error.message}`);
}
