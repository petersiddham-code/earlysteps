/**
 * Unit tests for media-at-rest encryption (issue #134, product plan §4.7). The
 * safety-relevant claims: it actually encrypts (ciphertext never contains plaintext),
 * round-trips losslessly, and a wrong key or tampered blob fails loudly (GCM auth tag)
 * instead of yielding garbage bytes.
 */
import { describe, it, expect } from 'vitest';
import { MediaEncryptionService } from '../src/media/media-encryption.service.js';

describe('MediaEncryptionService (AES-256-GCM, per-family key)', () => {
  const service = new MediaEncryptionService();

  it('generates distinct 32-byte base64 keys', () => {
    const a = service.generateKeyBase64();
    const b = service.generateKeyBase64();
    expect(Buffer.from(a, 'base64')).toHaveLength(32);
    expect(a).not.toEqual(b);
  });

  it('round-trips encrypt -> decrypt byte-for-byte', () => {
    const key = service.generateKeyBase64();
    const plaintext = Buffer.from('a captured observation, e.g. JPEG bytes \x00\x01\xff');
    const decrypted = service.decrypt(
      key,
      service.encrypt(key, plaintext, 'child-1'),
      'child-1',
    );
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('actually encrypts — ciphertext differs from and never contains the plaintext', () => {
    const key = service.generateKeyBase64();
    const plaintext = Buffer.from('recognizable-plaintext-marker'.repeat(10));
    const payload = service.encrypt(key, plaintext, 'child-1');
    expect(payload.equals(plaintext)).toBe(false);
    expect(payload.includes(Buffer.from('recognizable-plaintext-marker'))).toBe(false);
  });

  it('uses the documented wire format: 12-byte IV + 16-byte auth tag + ciphertext', () => {
    const key = service.generateKeyBase64();
    const plaintext = Buffer.from('12345');
    expect(service.encrypt(key, plaintext, 'child-1')).toHaveLength(
      12 + 16 + plaintext.length,
    );
  });

  it('a fresh random IV per call: same plaintext, same key, different ciphertext', () => {
    const key = service.generateKeyBase64();
    const plaintext = Buffer.from('same bytes twice');
    expect(
      service
        .encrypt(key, plaintext, 'child-1')
        .equals(service.encrypt(key, plaintext, 'child-1')),
    ).toBe(false);
  });

  it("another family's key cannot decrypt the blob", () => {
    const payload = service.encrypt(
      service.generateKeyBase64(),
      Buffer.from('secret'),
      'child-1',
    );
    expect(() =>
      service.decrypt(service.generateKeyBase64(), payload, 'child-1'),
    ).toThrow();
  });

  it('a tampered blob fails the auth tag instead of decrypting to garbage', () => {
    const key = service.generateKeyBase64();
    const payload = service.encrypt(key, Buffer.from('secret'), 'child-1');
    payload[payload.length - 1] ^= 0xff;
    expect(() => service.decrypt(key, payload, 'child-1')).toThrow();
  });

  it("a sibling's blob (same family key, wrong childId AAD) fails to decrypt", () => {
    // Security review, issue #134: two children in the same family share one key, so
    // this is the case key+IV alone would NOT have caught — only AAD does.
    const key = service.generateKeyBase64();
    const payload = service.encrypt(key, Buffer.from('secret'), 'child-1');
    expect(() => service.decrypt(key, payload, 'child-2')).toThrow();
  });
});
