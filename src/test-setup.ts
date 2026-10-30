// Test setup - runs before all tests
// Mock document for kit/format.ts which uses document.documentElement.lang
Object.defineProperty(globalThis, "document", {
  value: {
    documentElement: {
      lang: "fr",
      dataset: { currency: "EUR" },
    },
  },
  writable: true,
});

// Mock localStorage for tests
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true });