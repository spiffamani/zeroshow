export function padShowId(text: string): Uint8Array {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(text);
  out.set(encoded.slice(0, 32));
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToText(bytes: Uint8Array): string {
  const end = bytes.findIndex((b) => b === 0);
  const slice = end === -1 ? bytes : bytes.slice(0, end);
  return new TextDecoder().decode(slice);
}

export async function passphraseToSecret(passphrase: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase));
  return new Uint8Array(digest);
}

export function truncAddr(addr: string): string {
  return addr.length <= 24 ? addr : `${addr.slice(0, 14)}…${addr.slice(-8)}`;
}
