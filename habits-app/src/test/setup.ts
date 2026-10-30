// Mock document for tests
Object.defineProperty(global, "document", {
  value: {
    documentElement: {
      lang: "fr",
      dataset: { currency: "EUR" },
    },
  },
  writable: true,
});