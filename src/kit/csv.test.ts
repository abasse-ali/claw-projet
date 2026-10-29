// Tests pour la lecture et le parsing du CSV bancaire
import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseAmount } from "./format";
import { importCsv, parse } from "./csv";
import { categorize } from "./categories";
import { useEntries } from "./store";

// Nettoyer le store avant chaque test
beforeEach(() => {
  useEntries.setState({ entries: [], month: "2026-10", fresh: null });
  localStorage.clear();
  vi.clearAllMocks();
});

// Mock pour File et FileReader
global.File = class File {
  constructor(public chunks: string[], public name: string, public options: { type: string } = { type: "text/csv" }) {}
  get size() { return this.chunks.join("").length; }
  text() { return Promise.resolve(this.chunks.join("")); }
  slice() { return new File(this.chunks, this.name, this.options); }
} as any;

global.FileReader = class FileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsText(file: File) {
    file.text().then(text => {
      this.result = text;
      this.onload?.();
    });
  }
} as any;

describe("parseAmount", () => {
  it("parse un montant français avec virgule décimale", () => {
    expect(parseAmount("1 234,56")).toBe(1234.56);
    expect(parseAmount("-1 234,56")).toBe(-1234.56);
    expect(parseAmount("1234,56")).toBe(1234.56);
    expect(parseAmount("-8,50")).toBe(-8.5);
    expect(parseAmount("0,01")).toBe(0.01);
  });

  it("parse un montant avec point comme séparateur de milliers", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1234.56")).toBe(1234.56);
  });

  it("gère les montants sans décimales", () => {
    expect(parseAmount("100")).toBe(100);
    expect(parseAmount("-50")).toBe(-50);
  });

  it("retourne NaN pour du texte invalide", () => {
    expect(parseAmount("abc")).toBeNaN();
    expect(parseAmount("")).toBeNaN();
  });
});

describe("parse (CSV parser)", () => {
  it("parse un CSV simple avec point-virgule", () => {
    const csv = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;SNCF;-25,00`;
    const rows = parse(csv);
    expect(rows.length).toBe(3); // header + 2 lignes
    expect(rows[0]).toEqual(["Date", "Libellé", "Montant"]);
    expect(rows[1]).toEqual(["01/10/2026", "CARREFOUR", "-45,50"]);
    expect(rows[2]).toEqual(["02/10/2026", "SNCF", "-25,00"]);
  });

  it("gère les valeurs entre guillemets", () => {
    const csv = `Date;Libellé;Montant
01/10/2026;"CARREFOUR MARKET";-45,50`;
    const rows = parse(csv);
    expect(rows[1][1]).toBe("CARREFOUR MARKET");
  });

  it("gère les guillemets échappés", () => {
    const csv = `Date;Libellé;Montant
01/10/2026;"Achat ""CARREFOUR""";-45,50`;
    const rows = parse(csv);
    expect(rows[1][1]).toBe('Achat "CARREFOUR"');
  });

  it("ignore les lignes vides", () => {
    const csv = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50

02/10/2026;SNCF;-25,00`;
    const rows = parse(csv);
    expect(rows.length).toBe(3);
  });
});

describe("importCsv - format banque", () => {
  it("importe un relevé bancaire format Date;Libellé;Montant", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;SNCF;-25,00
03/10/2026;SALAIRE;2500,00`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    const result = await importCsv(file);

    expect(result.imported).toBe(3);
    expect(result.duplicates).toBe(0);
  });

  it("convertit les dates JJ/MM/AAAA en AAAA-MM-JJ", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
15/12/2026;SNCF;-25,00`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].date).toBe("2026-10-01");
    expect(entries[1].date).toBe("2026-12-15");
  });

  it("gère les années sur 2 chiffres", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/26;CARREFOUR;-45,50`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].date).toBe("2026-10-01");
  });

  it("met les montants négatifs pour les dépenses", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;SALAIRE;2500,00`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].amount).toBe(-45.50);
    expect(entries[1].amount).toBe(2500.00);
  });

  it("gère les espaces dans les montants (milliers)", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;GROS ACHAT;-1 234,56`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].amount).toBe(-1234.56);
  });

  it("catégorise automatiquement CARREFOUR en Courses", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;CARREFOUR MARKET;-45,50`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].category).toBe("Courses");
  });

  it("catégorise automatiquement SNCF en Transport", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;SNCF TER;-25,00`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].category).toBe("Transport");
  });
});

describe("importCsv - détection des doublons", () => {
  it("ignore les doublons exacts (même date, libellé, montant)", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;SNCF;-25,00`;

    const file1 = new File([csvContent], "releve1.csv", { type: "text/csv" });
    await importCsv(file1);

    // Importer le même fichier une deuxième fois
    const file2 = new File([csvContent], "releve2.csv", { type: "text/csv" });
    const result = await importCsv(file2);

    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(2);

    const entries = useEntries.getState().entries;
    expect(entries.length).toBe(2);
  });

  it("importe les nouvelles opérations et ignore les doublons", async () => {
    const csv1 = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;SNCF;-25,00`;

    const csv2 = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;SNCF;-25,00
03/10/2026;AMAZON;-30,00`;

    const file1 = new File([csv1], "releve1.csv", { type: "text/csv" });
    await importCsv(file1);

    const file2 = new File([csv2], "releve2.csv", { type: "text/csv" });
    const result = await importCsv(file2);

    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(2);

    const entries = useEntries.getState().entries;
    expect(entries.length).toBe(3);
  });

  it("considère comme doublon même si l'ordre des colonnes change", async () => {
    const csv1 = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50`;

    const csv2 = `Libellé;Date;Montant
CARREFOUR;01/10/2026;-45,50`;

    const file1 = new File([csv1], "releve1.csv", { type: "text/csv" });
    await importCsv(file1);

    const file2 = new File([csv2], "releve2.csv", { type: "text/csv" });
    const result = await importCsv(file2);

    expect(result.duplicates).toBe(1);
    expect(result.imported).toBe(0);
  });
});

describe("importCsv - format export appli", () => {
  it("importe le format export de l'appli (avec id et catégorie)", async () => {
    const csvContent = `date;libellé;montant;catégorie;id
2026-10-01;CARREFOUR;-45,50;Courses;abc123
2026-10-02;SNCF;-25,00;Transport;def456`;

    const file = new File([csvContent], "export.csv", { type: "text/csv" });
    const result = await importCsv(file);

    expect(result.imported).toBe(2);
    const entries = useEntries.getState().entries;
    expect(entries[0].id).toBe("abc123");
    expect(entries[0].category).toBe("Courses");
  });
});

describe("importCsv - cas limites", () => {
  it("retourne 0 pour un fichier vide", async () => {
    const file = new File([""], "vide.csv", { type: "text/csv" });
    const result = await importCsv(file);
    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(0);
  });

  it("retourne 0 pour un fichier sans opérations valides", async () => {
    const csvContent = `Date;Libellé;Montant
;;`;
    const file = new File([csvContent], "invalide.csv", { type: "text/csv" });
    const result = await importCsv(file);
    expect(result.imported).toBe(0);
  });

  it("ignore les lignes sans libellé", async () => {
    const csvContent = `Date;Libellé;Montant
01/10/2026;CARREFOUR;-45,50
02/10/2026;;-25,00
03/10/2026;SNCF;`;

    const file = new File([csvContent], "releve.csv", { type: "text/csv" });
    const result = await importCsv(file);

    expect(result.imported).toBe(1);
  });
});