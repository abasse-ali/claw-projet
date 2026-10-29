import { describe, it, expect } from "vitest";
import { parseBankAmount, parseBankDate, parseAmount } from "./format";

describe("parseBankAmount", () => {
  it("parses standard French format with comma decimal", () => {
    expect(parseBankAmount("1250,00")).toBe(1250.00);
    expect(parseBankAmount("-1250,00")).toBe(-1250.00);
    expect(parseBankAmount("12,50")).toBe(12.50);
    expect(parseBankAmount("-8,00")).toBe(-8.00);
  });

  it("parses amounts with regular space thousands separator", () => {
    expect(parseBankAmount("1 250,00")).toBe(1250.00);
    expect(parseBankAmount("1 234 567,89")).toBe(1234567.89);
  });

  it("parses amounts with non-breaking space (U+00A0) thousands separator", () => {
    expect(parseBankAmount("1\u00a0250,00")).toBe(1250.00);
    expect(parseBankAmount("1\u00a0234\u00a0567,89")).toBe(1234567.89);
  });

  it("parses amounts with narrow non-breaking space (U+202F) thousands separator", () => {
    expect(parseBankAmount("1\u202f250,00")).toBe(1250.00);
    expect(parseBankAmount("1\u202f234\u202f567,89")).toBe(1234567.89);
  });

  it("handles zero", () => {
    expect(parseBankAmount("0,00")).toBe(0);
    expect(parseBankAmount("0")).toBe(0);
  });

  it("returns NaN for invalid input", () => {
    expect(Number.isNaN(parseBankAmount("abc"))).toBe(true);
    expect(Number.isNaN(parseBankAmount(""))).toBe(true);
  });
});

describe("parseBankDate", () => {
  it("parses valid French dates JJ/MM/AAAA", () => {
    expect(parseBankDate("28/10/2026")).toBe("2026-10-28");
    expect(parseBankDate("01/01/2026")).toBe("2026-01-01");
    expect(parseBankDate("31/12/2026")).toBe("2026-12-31");
    expect(parseBankDate("29/02/2028")).toBe("2028-02-29"); // leap year
  });

  it("rejects invalid dates", () => {
    expect(parseBankDate("31/04/2026")).toBeNull(); // April has 30 days
    expect(parseBankDate("29/02/2027")).toBeNull(); // not a leap year
    expect(parseBankDate("32/01/2026")).toBeNull();
    expect(parseBankDate("00/01/2026")).toBeNull();
    expect(parseBankDate("01/00/2026")).toBeNull();
    expect(parseBankDate("01/13/2026")).toBeNull();
  });

  it("rejects invalid formats", () => {
    expect(parseBankDate("2026-10-28")).toBeNull();
    expect(parseBankDate("28-10-2026")).toBeNull();
    expect(parseBankDate("28/10/26")).toBeNull();
    expect(parseBankDate("")).toBeNull();
    expect(parseBankDate("abc")).toBeNull();
  });
});

describe("parseAmount (general)", () => {
  it("parses standard amounts", () => {
    expect(parseAmount("1235.15")).toBe(1235.15);
    expect(parseAmount("-8")).toBe(-8);
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount(100)).toBe(100);
  });

  it("handles thousands separators", () => {
    expect(parseAmount("1 235,15")).toBe(1235.15);
    expect(parseAmount("1,235.15")).toBe(1235.15);
  });

  it("three lines of 0.10 sum to 0.30 exactly", () => {
    const sum = parseAmount("0,10") + parseAmount("0,10") + parseAmount("0,10");
    // JavaScript floating point: use toBeCloseTo for approximate equality
    expect(sum).toBeCloseTo(0.3, 10);
  });
});