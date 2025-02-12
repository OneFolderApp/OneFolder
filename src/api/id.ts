
import { randomBytes } from 'crypto';
export type ID = string;

export function generateId(): ID {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  } else {
    // Fallback using Node's crypto module
    const bytes = randomBytes(16);
    // Per RFC4122 v4, set version and variant bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return (
      hex.substr(0, 8) + '-' +
      hex.substr(8, 4) + '-' +
      hex.substr(12, 4) + '-' +
      hex.substr(16, 4) + '-' +
      hex.substr(20, 12)
    );
  }
}
    