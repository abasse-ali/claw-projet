import { indexedDB as fakeIndexedDB } from "fake-indexeddb";
import { beforeAll, beforeEach, vi } from "vitest";

// Fake IndexedDB for tests
beforeAll(() => {
  global.indexedDB = fakeIndexedDB;
  // Marquer l'environnement de test pour que le store utilise testStorage
  (globalThis as any).__vitest__ = true;
});

// Clear IndexedDB before each test
beforeEach(() => {
  const stores = ["shopping-app"];
  for (const storeName of stores) {
    try {
      const req = indexedDB.deleteDatabase(storeName);
      req.onerror = () => {};
    } catch {
      // Ignore errors
    }
  }
});

// Mock localStorage for tests that still use it directly
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal("localStorage", localStorageMock);