import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * Media-at-rest encryption (issue #134, product plan §4.7): AES-256-GCM with a per-family
 * key, applied BEFORE the object-storage adapter ever sees bytes — the adapter stays a
 * dumb opaque-blob store with no knowledge of encryption.
 *
 * Wire format: iv (12 bytes) || authTag (16 bytes) || ciphertext. GCM's auth tag means a
 * blob decrypted with the wrong family's key, or tampered with on disk, fails loudly
 * instead of yielding garbage bytes.
 *
 * `aad` binds a blob to the child it belongs to. A family's key is shared across all of
 * that family's children, so key+IV alone wouldn't stop a blob accidentally or maliciously
 * associated with the wrong sibling's DB row from still decrypting "successfully" — passing
 * childId as AAD makes that combination fail the auth-tag check instead (security review,
 * issue #134).
 */
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class MediaEncryptionService {
  /** A fresh per-family key: base64 of 32 random bytes, stored on Family.mediaEncryptionKey. */
  generateKeyBase64(): string {
    return randomBytes(32).toString('base64');
  }

  encrypt(keyBase64: string, plaintext: Buffer, aad: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyBase64, 'base64'), iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  }

  decrypt(keyBase64: string, payload: Buffer, aad: string): Buffer {
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(keyBase64, 'base64'),
      iv,
    );
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
