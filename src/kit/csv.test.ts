import { describe, it, expect } from "vitest";
import { parseBankCsv, parseFrenchDate, parseFrenchAmount, makeEntryKey, autoCategorize } from "./csv";
import { parseAmount, money } from "./format";

// Tests pour parseFrenchDate
describe("parseFrenchDate", () => {
  it("convertit une date JJ/MM/AAAA en AAAA-MM-JJ", () => {
    expect(parseFrenchDate("28/10/2026")).toBe("2026-10-28");
    expect(parseFrenchDate("01/01/2024")).toBe("2024-01-01");
    expect(parseFrenchDate("31/12/2025")).toBe("2025-12-31");
  });

  it("retourne la date du jour pour un format invalide", () => {
    const todayStr = new Date().toISOString().split("T")[0];
    expect(parseFrenchDate("invalid")).toBe(todayStr);
    expect(parseFrenchDate("28-10-2026")).toBe(todayStr);
    expect(parseFrenchDate("")).toBe(todayStr);
  });

  it("retourne la date du jour pour une date impossible", () => {
    const todayStr = new Date().toISOString().split("T")[0];
    expect(parseFrenchDate("31/04/2026")).toBe(todayStr); // Avril n'a pas 31 jours
    expect(parseFrenchDate("29/02/2027")).toBe(todayStr); // 2027 n'est pas bissextile
  });
});

// Tests pour parseFrenchAmount
describe("parseFrenchAmount", () => {
  it("parse un montant avec virgule décimale", () => {
    expect(parseFrenchAmount("1250,50")).toBe(1250.50);
    expect(parseFrenchAmount("12,50")).toBe(12.50);
    expect(parseFrenchAmount("0,01")).toBe(0.01);
  });

  it("parse un montant avec espace comme séparateur de milliers", () => {
    expect(parseFrenchAmount("1 250,50")).toBe(1250.50);
    expect(parseFrenchAmount("10 000,00")).toBe(10000.00);
  });

  it("parse un montant avec espace insécable (U+00A0)", () => {
    expect(parseFrenchAmount("1\u00A0250,50")).toBe(1250.50);
  });

  it("parse un montant avec espace fine insécable (U+202F)", () => {
    expect(parseFrenchAmount("1\u202F250,50")).toBe(1250.50);
  });

  it("gère les montants négatifs (dépenses)", () => {
    expect(parseFrenchAmount("-50,00")).toBe(-50.00);
    expect(parseFrenchAmount("-1 250,50")).toBe(-1250.50);
  });

  it("retourne NaN pour un format invalide", () => {
    expect(isNaN(parseFrenchAmount("invalid"))).toBe(true);
    expect(isNaN(parseFrenchAmount(""))).toBe(true);
  });
});

// Tests pour makeEntryKey
describe("makeEntryKey", () => {
  it("génère une clé unique cohérente", () => {
    const key1 = makeEntryKey("2026-10-28", "CARREFOUR", -50.00);
    const key2 = makeEntryKey("2026-10-28", "carrefour", -50.00);
    expect(key1).toBe(key2); // Insensible à la casse
    expect(key1).toBe("2026-10-28|carrefour|-50.00");
  });

  it("différencie les opérations différentes", () => {
    expect(makeEntryKey("2026-10-28", "CARREFOUR", -50.00)).not.toBe(
      makeEntryKey("2026-10-28", "SNCF", -50.00)
    );
    expect(makeEntryKey("2026-10-28", "CARREFOUR", -50.00)).not.toBe(
      makeEntryKey("2026-10-29", "CARREFOUR", -50.00)
    );
    expect(makeEntryKey("2026-10-28", "CARREFOUR", -50.00)).not.toBe(
      makeEntryKey("2026-10-28", "CARREFOUR", -30.00)
    );
  });
});

// Tests pour parseBankCsv
describe("parseBankCsv", () => {
  it("parse un CSV simple avec point-virgule", () => {
    const csv = `Date;Libellé;Montant
28/10/2026;CARREFOUR;-50,00
29/10/2026;SNCF;-25,50`;
    const rows = parseBankCsv(csv);
    expect(rows.length).toBe(3); // header + 2 lignes
    expect(rows[0]).toEqual(["Date", "Libellé", "Montant"]);
    expect(rows[1]).toEqual(["28/10/2026", "CARREFOUR", "-50,00"]);
    expect(rows[2]).toEqual(["29/10/2026", "SNCF", "-25,50"]);
  });

  it("gère les valeurs entre guillemets", () => {
    const csv = `Date;Libellé;Montant
28/10/2026;"CARREFOUR MARKET";-50,00`;
    const rows = parseBankCsv(csv);
    expect(rows[1][1]).toBe("CARREFOUR MARKET");
  });

  it("gère les guillemets échappés", () => {
    const csv = `Date;Libellé;Montant
28/10/2026;"ACHAT ""SPECIAL""";-50,00`;
    const rows = parseBankCsv(csv);
    expect(rows[1][1]).toBe('ACHAT "SPECIAL"');
  });

  it("ignore les lignes vides", () => {
    const csv = `Date;Libellé;Montant

28/10/2026;CARREFOUR;-50,00

29/10/2026;SNCF;-25,50`;
    const rows = parseBankCsv(csv);
    expect(rows.length).toBe(3); // header + 2 lignes de données
  });

  it("gère le BOM UTF-8", () => {
    const csv = `\ufeffDate;Libellé;Montant
28/10/2026;CARREFOUR;-50,00`;
    const rows = parseBankCsv(csv);
    expect(rows[0][0]).toBe("Date"); // Pas de BOM dans le header
  });
});

// Tests pour autoCategorize
describe("autoCategorize", () => {
  it("catégorise CARREFOUR en Courses", () => {
    const entries = [{ id: "1", label: "CARREFOUR", amount: -50, category: "", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Courses");
  });

  it("catégorise SNCF en Transport", () => {
    const entries = [{ id: "1", label: "SNCF TGV", amount: -80, category: "", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Transport");
  });

  it("catégorise AMAZON en Shopping", () => {
    const entries = [{ id: "1", label: "AMAZON FRANCE", amount: -35, category: "", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Shopping");
  });

  it("catégorise PHARMACIE en Santé", () => {
    const entries = [{ id: "1", label: "PHARMACIE CENTRALE", amount: -25, category: "", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Santé");
  });

  it("catégorise SALAIRE en Revenus", () => {
    const entries = [{ id: "1", label: "VIREMENT SALAIRE OCTOBRE", amount: 2500, category: "", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Revenus");
  });

  it("ne change pas une catégorie déjà définie", () => {
    const entries = [{ id: "1", label: "CARREFOUR", amount: -50, category: "Personnalisée", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Personnalisée");
  });

  it("met 'Autre' pour un libellé non reconnu", () => {
    const entries = [{ id: "1", label: "ACHAT INCONNU XYZ", amount: -100, category: "", date: "2026-10-28" }];
    const result = autoCategorize(entries);
    expect(result[0].category).toBe("Autre");
  });

  it("est insensible à la casse", () => {
    const entries = [
      { id: "1", label: "carrefour", amount: -50, category: "", date: "2026-10-28" },
      { id: "2", label: "CARREFOUR", amount: -50, category: "", date: "2026-10-28" },
    ];
    const result = autoCategorize(entries);
    expect(result.every(e => e.category === "Courses")).toBe(true);
  });
});

// Tests pour la déduplication (via makeEntryKey)
describe("Déduplication - makeEntryKey", () => {
  it("n'importe pas les doublons (même date, libellé, montant)", () => {
    const existing = [
      { date: "2026-10-28", label: "CARREFOUR", amount: -50.00 },
      { date: "2026-10-29", label: "SNCF", amount: -25.50 },
    ];
    const existingKeys = new Set(existing.map(e => makeEntryKey(e.date, e.label, e.amount)));
    
    // Même opération
    expect(existingKeys.has(makeEntryKey("2026-10-28", "CARREFOUR", -50.00))).toBe(true);
    expect(existingKeys.has(makeEntryKey("2026-10-28", "carrefour", -50.00))).toBe(true); // casse
    
    // Opérations différentes
    expect(existingKeys.has(makeEntryKey("2026-10-28", "CARREFOUR", -30.00))).toBe(false); // montant différent
    expect(existingKeys.has(makeEntryKey("2026-10-30", "CARREFOUR", -50.00))).toBe(false); // date différente
    expect(existingKeys.has(makeEntryKey("2026-10-28", "SNCF", -50.00))).toBe(false); // libellé différent
  });
});

describe("format - parseAmount", () => {
  it("parse les montants français", () => {
    expect(parseAmount("1 250,50")).toBe(1250.50);
    expect(parseAmount("12,50")).toBe(12.50);
    expect(parseAmount("-50,00")).toBe(-50.00);
    expect(parseAmount("1000")).toBe(1000);
  });

  it("gère les espaces insécables", () => {
    expect(parseAmount("1\u00A0250,50")).toBe(1250.50);
    expect(parseAmount("1\u202F250,50")).toBe(1250.50);
  });
});

describe("format - money", () => {
  it("formate correctement en euros", () => {
    expect(money(1250.50)).toContain("1");
    expect(money(1250.50)).toContain("250");
    expect(money(1250.50)).toContain("50");
    expect(money(0)).toContain("0");
    expect(money(-50)).toContain("-");
  });
});