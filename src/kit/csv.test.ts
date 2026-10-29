import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseBankAmount, parseBankDate } from "./format";
import { categorize } from "./categorize";

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// Mock File and FileReader
class MockFile extends Blob {
  name: string;
  constructor(content: string, options: { name: string; type?: string } = { name: "test.csv" }) {
    super([content], { type: options.type || "text/csv" });
    this.name = options.name;
  }
  text(): Promise<string> {
    return Promise.resolve(this.arrayBuffer().then(buf => new TextDecoder().decode(buf)));
  }
}

// Test the CSV parsing logic directly
describe("CSV parsing logic", () => {
  const sampleCsv = `Date;Libellé;Montant
28/10/2026;CARREFOUR MARKET;-45,50
27/10/2026;SNCF;-25,00
26/10/2026;SALAIRE OCTOBRE;2500,00
25/10/2026;PHARMACIE CENTRALE;-12,30`;

  const sampleCsvWithSpaces = `Date;Libellé;Montant
28/10/2026;CARREFOUR MARKET;-1 250,00
27/10/2026;TOTAL ESSENCE;-50\u00a000`;

  it("parses CSV with semicolon separator", () => {
    const lines = sampleCsv.split("\n");
    const headers = lines[0].split(";");
    expect(headers).toEqual(["Date", "Libellé", "Montant"]);
  });

  it("parses French dates correctly", () => {
    expect(parseBankDate("28/10/2026")).toBe("2026-10-28");
    expect(parseBankDate("01/01/2026")).toBe("2026-01-01");
  });

  it("parses French amounts with comma decimal", () => {
    expect(parseBankAmount("-45,50")).toBe(-45.50);
    expect(parseBankAmount("2500,00")).toBe(2500.00);
  });

  it("parses amounts with space thousands separator", () => {
    expect(parseBankAmount("-1 250,00")).toBe(-1250.00);
    expect(parseBankAmount("-50\u00a000")).toBe(-5000);
  });

  it("categorizes operations correctly from labels", () => {
    expect(categorize("CARREFOUR MARKET")).toBe("Courses");
    expect(categorize("SNCF")).toBe("Transport");
    expect(categorize("SALAIRE OCTOBRE")).toBe("Salaire");
    expect(categorize("PHARMACIE CENTRALE")).toBe("Santé");
  });
});

// Test for duplicate detection
describe("Duplicate detection", () => {
  // This tests the duplicateKey function logic
  function duplicateKey(date: string, label: string, amount: number): string {
    return `${date}|${label.trim().toLowerCase()}|${Math.round(amount * 100)}`;
  }

  it("generates same key for identical operations", () => {
    const key1 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    const key2 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    expect(key1).toBe(key2);
  });

  it("generates different keys for different dates", () => {
    const key1 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    const key2 = duplicateKey("2026-10-27", "CARREFOUR MARKET", -45.50);
    expect(key1).not.toBe(key2);
  });

  it("generates different keys for different labels", () => {
    const key1 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    const key2 = duplicateKey("2026-10-28", "SNCF", -45.50);
    expect(key1).not.toBe(key2);
  });

  it("generates different keys for different amounts", () => {
    const key1 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    const key2 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -50.00);
    expect(key1).not.toBe(key2);
  });

  it("is case insensitive for label", () => {
    const key1 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    const key2 = duplicateKey("2026-10-28", "carrefour market", -45.50);
    expect(key1).toBe(key2);
  });

  it("ignores whitespace in label", () => {
    const key1 = duplicateKey("2026-10-28", "CARREFOUR MARKET", -45.50);
    const key2 = duplicateKey("2026-10-28", "  CARREFOUR MARKET  ", -45.50);
    expect(key1).toBe(key2);
  });
});

// Test for overlapping imports (simulated)
describe("Overlapping imports", () => {
  function duplicateKey(date: string, label: string, amount: number): string {
    return `${date}|${label.trim().toLowerCase()}|${Math.round(amount * 100)}`;
  }

  it("detects duplicates when importing overlapping statements", () => {
    // First import
    const entries1 = [
      { date: "2026-10-28", label: "CARREFOUR MARKET", amount: -45.50, category: "Courses" },
      { date: "2026-10-27", label: "SNCF", amount: -25.00, category: "Transport" },
      { date: "2026-10-26", label: "SALAIRE", amount: 2500.00, category: "Salaire" },
    ];
    const keys1 = new Set(entries1.map(e => duplicateKey(e.date, e.label, e.amount)));

    // Second import (overlapping - contains first two entries again)
    const entries2 = [
      { date: "2026-10-28", label: "CARREFOUR MARKET", amount: -45.50, category: "Courses" },
      { date: "2026-10-27", label: "SNCF", amount: -25.00, category: "Transport" },
      { date: "2026-10-25", label: "PHARMACIE", amount: -12.30, category: "Santé" },
    ];

    const newEntries = entries2.filter(e => !keys1.has(duplicateKey(e.date, e.label, e.amount)));
    
    expect(newEntries.length).toBe(1);
    expect(newEntries[0].label).toBe("PHARMACIE");
  });

  it("imports all entries when no overlap", () => {
    const entries1 = [
      { date: "2026-10-28", label: "CARREFOUR MARKET", amount: -45.50, category: "Courses" },
    ];
    const keys1 = new Set(entries1.map(e => duplicateKey(e.date, e.label, e.amount)));

    const entries2 = [
      { date: "2026-10-27", label: "SNCF", amount: -25.00, category: "Transport" },
      { date: "2026-10-26", label: "SALAIRE", amount: 2500.00, category: "Salaire" },
    ];

    const newEntries = entries2.filter(e => !keys1.has(duplicateKey(e.date, e.label, e.amount)));
    
    expect(newEntries.length).toBe(2);
  });

  it("imports zero entries when fully duplicate", () => {
    const entries1 = [
      { date: "2026-10-28", label: "CARREFOUR MARKET", amount: -45.50, category: "Courses" },
      { date: "2026-10-27", label: "SNCF", amount: -25.00, category: "Transport" },
    ];
    const keys1 = new Set(entries1.map(e => duplicateKey(e.date, e.label, e.amount)));

    const entries2 = [
      { date: "2026-10-28", label: "CARREFOUR MARKET", amount: -45.50, category: "Courses" },
      { date: "2026-10-27", label: "SNCF", amount: -25.00, category: "Transport" },
    ];

    const newEntries = entries2.filter(e => !keys1.has(duplicateKey(e.date, e.label, e.amount)));
    
    expect(newEntries.length).toBe(0);
  });
});