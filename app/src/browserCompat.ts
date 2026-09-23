const fallbackRandomId = () => {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};

export const makeUuid = () =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : fallbackRandomId();

export const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
};

export const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
    return;
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // A kliens Firebase-azonosítóval ettől még működhet az aktuális oldalletöltésben.
    }
  }
};

export const parseCreditInput = (raw: string): number | '' => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const value = Number(digits);
  return Number.isFinite(value) ? value : '';
};
