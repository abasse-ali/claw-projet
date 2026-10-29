import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseBankCsv, importBankCsv } from "./bank-csv";
import { categorize, DEFAULT_CATEGORIES, type CategoryRule } from "./categorize";
import { parseAmount, money, today, monthOf, shiftMonth, monthName, shortMonth, dayLabel, daysLeft } from "../kit/format";
import { inMonth, totals, newestFirst, STORE_KEY, seedOnce } from "../kit/store";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

// Mock toast
vi.mock("../kit/toast", () => ({
  toast: vi.fn(),
}));

// Mock useEntries store
vi.mock("../kit/store", async () => {
  const actual = await vi.importActual("../kit/store");
  const mockEntries: any[] = [];
  return {
    ...actual,
    useEntries: {
      getState: () => ({ entries: mockEntries }),
      setState: vi.fn((updater: any) => {
        if (typeof updater === "function") {
          mockEntries.splice(0, mockEntries.length, ...updater(mockEntries));
        } else {
          mockEntries.splice(0, mockEntries.length, ...updater.entries);
        }
      }),
    },
    STORE_KEY: "test-app",
  };
});

describe("parseAmount", () => {
  it("parses simple numbers", () => {
    expect(parseAmount("42")).toBe(42);
    expect(parseAmount("42.5")).toBe(42.5);
    expect(parseAmount("-42.5")).toBe(-42.5);
  });

  it("parses French format with comma", () => {
    expect(parseAmount("42,50")).toBe(42.5);
    expect(parseAmount("-1 234,56")).toBe(-1234.56);
    expect(parseAmount("1 000 000,00")).toBe(1000000);
  });

  it("handles euro signs", () => {
    expect(parseAmount("42,50 €")).toBe(42.5);
    expect(parseAmount("-10,00 eur")).toBe(-10);
  });

  it("returns NaN for invalid input", () => {
    expect(parseAmount("abc")).toBeNaN();
    expect(parseAmount("")).toBeNaN();
  });
});

describe("money", () => {
  it("formats numbers as French currency", () => {
    // money() uses narrow no-break space (U+202F) and no-break space (U+00A0)
    expect(money(1235.15)).toBe("1\u202f235,15\u00a0€");
    expect(money(-45.67)).toBe("-45,67\u00a0€");
    expect(money(0)).toBe("0,00\u00a0€");
  });
});

describe("date functions", () => {
  it("today returns YYYY-MM-DD", () => {
    const todayStr = today();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("monthOf extracts month from date", () => {
    expect(monthOf("2026-10-28")).toBe("2026-10");
  });

  it("shiftMonth shifts months correctly", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("monthName returns French month name", () => {
    expect(monthName("2026-10")).toBe("Octobre 2026");
    expect(monthName("2026-01")).toBe("Janvier 2026");
  });

  it("shortMonth returns abbreviated month", () => {
    expect(shortMonth("2026-10")).toBe("oct.");
  });

  it("dayLabel returns day and month", () => {
    expect(dayLabel("2026-10-28")).toBe("28 oct.");
  });

  it("daysLeft returns remaining days in month", () => {
    const currentMonth = monthOf(today());
    const days = daysLeft(currentMonth);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(31);
  });
});

describe("store functions", () => {
  it("inMonth filters entries by month", () => {
    const entries = [
      { id: "1", date: "2026-10-01", amount: -10, label: "Test", category: "Autre" },
      { id: "2", date: "2026-11-01", amount: -20, label: "Test", category: "Autre" },
    ];
    expect(inMonth(entries, "2026-10")).toHaveLength(1);
    expect(inMonth(entries, "2026-11")).toHaveLength(1);
  });

  it("totals calculates income, spending, balance", () => {
    const entries = [
      { id: "1", date: "2026-10-01", amount: 1000, label: "Salaire", category: "Salaire" },
      { id: "2", date: "2026-10-02", amount: -50, label: "Courses", category: "Courses" },
      { id: "3", date: "2026-10-03", amount: -30, label: "Transport", category: "Transport" },
    ];
    const result = totals(entries);
    expect(result.income).toBe(1000);
    expect(result.spending).toBe(80);
    expect(result.balance).toBe(920);
  });

  it("newestFirst sorts by date descending", () => {
    const entries = [
      { id: "1", date: "2026-10-01", amount: -10, label: "Test", category: "Autre" },
      { id: "2", date: "2026-10-03", amount: -20, label: "Test", category: "Autre" },
      { id: "3", date: "2026-10-02", amount: -30, label: "Test", category: "Autre" },
    ];
    const sorted = newestFirst(entries);
    expect(sorted[0].date).toBe("2026-10-03");
    expect(sorted[1].date).toBe("2026-10-02");
    expect(sorted[2].date).toBe("2026-10-01");
  });
});

describe("categorize", () => {
  it("categorizes known merchants", () => {
    expect(categorize("CARREFOUR MARKET")).toBe("Courses");
    expect(categorize("SNCF")).toBe("Transport");
    expect(categorize("AMAZON.FR")).toBe("Shopping");
    expect(categorize("UBER")).toBe("Transport");
    expect(categorize("PHARMACIE CENTRALE")).toBe("Santé");
  });

  it("is case insensitive", () => {
    expect(categorize("carrefour")).toBe("Courses");
    expect(categorize("Carrefour")).toBe("Courses");
    expect(categorize("CARREFOUR")).toBe("Courses");
  });

  it("handles accents", () => {
    expect(categorize("CAFE DE LA PAIX")).toBe("Cafés");
    expect(categorize("BOULANGERIE")).toBe("Cafés");
  });

  it("returns Autre for unknown", () => {
    expect(categorize("MACHIN TRUC")).toBe("Autre");
    expect(categorize("")).toBe("Autre");
  });

  it("matches partial keywords", () => {
    expect(categorize("CARREFOUR CONTACT")).toBe("Courses");
    expect(categorize("TOTAL ENERGIES")).toBe("Transport");
  });
});

describe("parseBankCsv", () => {
  const createMockFile = (content: string) => {
    return new File([content], "test.csv", { type: "text/csv" });
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { useEntries } = await import("../kit/store");
    useEntries.setState({ entries: [] });
  });

  it("parses CSV with header", async () => {
    const csvContent = `Date;Libelle;Montant
28/10/2026;CARREFOUR MARKET;-45,67
29/10/2026;SNCF;-25,50
30/10/2026;SALAIRE;2500,00`;

    const file = createMockFile(csvContent);
    const result = await parseBankCsv(file);

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].label).toBe("CARREFOUR MARKET");
    expect(result.entries[0].amount).toBe(-45.67);
    expect(result.entries[0].category).toBe("Courses");
    expect(result.entries[0].date).toBe("2026-10-28");
    expect(result.entries[2].amount).toBe(2500);
    expect(result.entries[2].category).toBe("Salaire/Revenus");
  });

  it("parses CSV without header", async () => {
    const csvContent = `28/10/2026;CARREFOUR MARKET;-45,67
29/10/2026;SNCF;-25,50`;

    const file = createMockFile(csvContent);
    const result = await parseBankCsv(file);

    expect(result.entries).toHaveLength(2);
  });

  it("handles amounts with thousands separator", async () => {
    const csvContent = `Date;Libelle;Montant
28/10/2026;GROS ACHAT;-1 234,56`;

    const file = createMockFile(csvContent);
    const result = await parseBankCsv(file);

    expect(result.entries[0].amount).toBe(-1234.56);
  });

  it("skips empty lines", async () => {
    const csvContent = `Date;Libelle;Montant

28/10/2026;CARREFOUR;-45,67

29/10/2026;SNCF;-25,50
`;

    const file = createMockFile(csvContent);
    const result = await parseBankCsv(file);

    expect(result.entries).toHaveLength(2);
  });

  it("detects duplicates with existing entries", async () => {
    // First import
    const csv1 = `Date;Libelle;Montant
28/10/2026;CARREFOUR MARKET;-45,67`;
    await importBankCsv(createMockFile(csv1));

    // Second import with overlapping data
    const csv2 = `Date;Libelle;Montant
28/10/2026;CARREFOUR MARKET;-45,67
29/10/2026;SNCF;-25,50`;

    const file2 = createMockFile(csv2);
    const result = await parseBankCsv(file2);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].label).toBe("SNCF");
    expect(result.duplicates).toBe(1);
  });

  it("returns 0 entries for empty file", async () => {
    const file = createMockFile("");
    const result = await parseBankCsv(file);
    expect(result.entries).toHaveLength(0);
  });

  it("returns 0 entries for header only", async () => {
    const file = createMockFile("Date;Libelle;Montant");
    const result = await parseBankCsv(file);
    expect(result.entries).toHaveLength(0);
  });
});

describe("importBankCsv", () => {
  const createMockFile = (content: string) => {
    return new File([content], "test.csv", { type: "text/csv" });
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { useEntries } = await import("../kit/store");
    useEntries.setState({ entries: [] });
  });

  it("imports entries and returns count", async () => {
    const csvContent = `Date;Libelle;Montant
28/10/2026;CARREFOUR;-45,67
29/10/2026;SNCF;-25,50`;

    const count = await importBankCsv(createMockFile(csvContent));
    expect(count).toBe(2);

    const { useEntries } = await import("../kit/store");
    const entries = useEntries.getState().entries;
    expect(entries).toHaveLength(2);
  });

  it("does not duplicate on re-import", async () => {
    const csvContent = `Date;Libelle;Montant
28/10/2026;CARREFOUR;-45,67`;

    await importBankCsv(createMockFile(csvContent));
    const count = await importBankCsv(createMockFile(csvContent));

    expect(count).toBe(0);

    const { useEntries } = await import("../kit/store");
    expect(useEntries.getState().entries).toHaveLength(1);
  });

  it("shows toast on successful import", async () => {
    const { toast } = await import("../kit/toast");
    const csvContent = `Date;Libelle;Montant
28/10/2026;CARREFOUR;-45,67`;

    await importBankCsv(createMockFile(csvContent));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("importee"), expect.any(Object));
  });
});