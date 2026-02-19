import '@testing-library/jest-dom/vitest';

// jsdom's localStorage can be broken when --localstorage-file isn't configured.
// Provide a working in-memory implementation.
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  },
  writable: true,
  configurable: true,
});
