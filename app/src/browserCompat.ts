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

// Keep the latest value available even when both browser storage quotas are full.
// sessionStorage is a reload-safe spill area; an older localStorage value must
// never take precedence over a newer value written there.
const memoryStorage = new Map<string, string>();

export const storageKeys = (prefix: string) => {
  const keys = new Set(memoryStorage.keys());
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { for (const key of Object.keys(window[name])) keys.add(key); } catch { /* Storage can be disabled. */ }
  }
  return [...keys].filter(key => key.startsWith(prefix));
};

export const removeStorage = (key: string) => {
  memoryStorage.delete(key);
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { window[name].removeItem(key); } catch { /* Best-effort cache removal. */ }
  }
};

export const readStorage = (key: string) => {
  if (memoryStorage.has(key)) return memoryStorage.get(key)!;
  try {
    const spill = window.sessionStorage.getItem(key);
    if (spill !== null) return spill;
  } catch { /* Continue with localStorage when sessionStorage is unavailable. */ }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
    memoryStorage.delete(key);
    try { window.sessionStorage.removeItem(key); } catch { /* Cache cleanup only. */ }
    return;
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
      memoryStorage.delete(key);
    } catch {
      memoryStorage.set(key, value);
    }
  }
};

export const formatCreditInput = (value: number | '') =>
  value === '' ? '' : Math.max(0, Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const parseCreditInput = (raw: string): number | '' => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const value = Number(digits);
  return Number.isFinite(value) ? value : '';
};
