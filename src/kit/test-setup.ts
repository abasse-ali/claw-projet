// Mock global document et localStorage pour les tests
// Ce fichier est chargé avant les tests par vitest

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Mock document
Object.defineProperty(globalThis, "document", {
  value: {
    documentElement: {
      lang: "fr",
      dataset: { currency: "EUR" },
    },
    createElement: () => ({
      click: () => {},
      remove: () => {},
    }),
    body: {
      append: () => {},
    },
  },
  writable: true,
});

// Mock URL.createObjectURL et revokeObjectURL
globalThis.URL.createObjectURL = () => "blob:mock";
globalThis.URL.revokeObjectURL = () => {};