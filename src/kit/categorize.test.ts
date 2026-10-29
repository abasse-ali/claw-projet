import { describe, it, expect } from "vitest";
import { categorize, getAllCategories, CATEGORY_RULES, DEFAULT_CATEGORY } from "./categorize";

describe("categorize", () => {
  it("categorizes Courses correctly", () => {
    expect(categorize("CARREFOUR MARKET")).toBe("Courses");
    expect(categorize("LECLERC DRIVE")).toBe("Courses");
    expect(categorize("AUCHAN SUPERMARCHE")).toBe("Courses");
    expect(categorize("INTERMARCHE")).toBe("Courses");
    expect(categorize("MONOPRIX")).toBe("Courses");
    expect(categorize("FRANPRIX")).toBe("Courses");
    expect(categorize("CASINO")).toBe("Courses");
    expect(categorize("SUPER U")).toBe("Courses");
    expect(categorize("HYPER U")).toBe("Courses");
    expect(categorize("CORA")).toBe("Courses");
    expect(categorize("LIDL")).toBe("Courses");
    expect(categorize("ALDI")).toBe("Courses");
    expect(categorize("PICARD")).toBe("Courses");
    expect(categorize("BIOCOOP")).toBe("Courses");
  });

  it("categorizes Transport correctly", () => {
    expect(categorize("SNCF")).toBe("Transport");
    expect(categorize("TER BRETAGNE")).toBe("Transport");
    expect(categorize("TGV INOUI")).toBe("Transport");
    expect(categorize("OUI GO")).toBe("Transport");
    expect(categorize("RATP")).toBe("Transport");
    expect(categorize("METRO PARIS")).toBe("Transport");
    expect(categorize("VELIB")).toBe("Transport");
    expect(categorize("UBER TRIP")).toBe("Transport");
    expect(categorize("TOTAL ESSENCE")).toBe("Transport");
    expect(categorize("SHELL CARBURANT")).toBe("Transport");
  });

  it("categorizes Logement correctly", () => {
    expect(categorize("LOYER NOVEMBRE")).toBe("Logement");
    expect(categorize("EDF FACTURE")).toBe("Logement");
    expect(categorize("ENGIE GAZ")).toBe("Logement");
    expect(categorize("VEOLIA EAU")).toBe("Logement");
    expect(categorize("ORANGE BOX")).toBe("Logement");
    expect(categorize("FREE INTERNET")).toBe("Logement");
  });

  it("categorizes Santé correctly", () => {
    expect(categorize("PHARMACIE CENTRALE")).toBe("Santé");
    expect(categorize("DOCTEUR MARTIN")).toBe("Santé");
    expect(categorize("DENTISTE")).toBe("Santé");
    expect(categorize("OPTICIEN LUNETTES")).toBe("Santé");
    expect(categorize("MUTUELLE SANTE")).toBe("Santé");
    expect(categorize("CPAM REMBOURSEMENT")).toBe("Santé");
  });

  it("categorizes Restauration correctly", () => {
    expect(categorize("RESTAURANT LE BISTRO")).toBe("Restauration");
    expect(categorize("MC DONALDS")).toBe("Restauration");
    expect(categorize("KFC FRANCE")).toBe("Restauration");
    expect(categorize("UBER EATS")).toBe("Restauration");
    expect(categorize("DELIVEROO")).toBe("Restauration");
    expect(categorize("CAFE DE LA PLACE")).toBe("Restauration");
  });

  it("categorizes Shopping correctly", () => {
    expect(categorize("AMAZON FRANCE")).toBe("Shopping");
    expect(categorize("FNAC")).toBe("Shopping");
    expect(categorize("DARTY")).toBe("Shopping");
    expect(categorize("ZARA")).toBe("Shopping");
    expect(categorize("H&M")).toBe("Shopping");
    expect(categorize("DECATHLON")).toBe("Shopping");
    expect(categorize("VINTED")).toBe("Shopping");
  });

  it("categorizes Loisirs correctly", () => {
    expect(categorize("CINEMA GAUMONT")).toBe("Loisirs");
    expect(categorize("NETFLIX ABONNEMENT")).toBe("Loisirs");
    expect(categorize("SPOTIFY PREMIUM")).toBe("Loisirs");
    expect(categorize("BASIC FIT")).toBe("Loisirs");
    expect(categorize("STEAM JEUX")).toBe("Loisirs");
  });

  it("categorizes Banque correctly", () => {
    expect(categorize("FRAIS BANCAIRES")).toBe("Banque");
    expect(categorize("COTISATION CARTE")).toBe("Banque");
    expect(categorize("AGIOS")).toBe("Banque");
    expect(categorize("LIVRET A")).toBe("Banque");
    expect(categorize("ASSURANCE VIE")).toBe("Banque");
  });

  it("categorizes Salaire correctly", () => {
    expect(categorize("SALAIRE OCTOBRE")).toBe("Salaire");
    expect(categorize("REMUNERATION")).toBe("Salaire");
    expect(categorize("PRIME ANNUELLE")).toBe("Salaire");
    expect(categorize("CAF ALLOCATION")).toBe("Salaire");
    expect(categorize("POLE EMPLOI")).toBe("Salaire");
  });

  it("categorizes Virements correctly", () => {
    expect(categorize("VIREMENT RECU")).toBe("Virements");
    expect(categorize("VIREMENT INSTANTANE")).toBe("Virements");
    expect(categorize("REMBOURSEMENT")).toBe("Virements");
  });

  it("returns Autre for unknown labels", () => {
    expect(categorize("ACHAT INCONNU")).toBe("Autre");
    expect(categorize("XYZ RANDOM")).toBe("Autre");
    expect(categorize("")).toBe("Autre");
  });

  it("is case insensitive", () => {
    expect(categorize("carrefour")).toBe("Courses");
    expect(categorize("SnCf")).toBe("Transport");
    expect(categorize("PhArMaCiE")).toBe("Santé");
  });

  it("matches first rule in order", () => {
    // "CARREFOUR TRANSPORT" should be Courses because Courses rule comes first
    expect(categorize("CARREFOUR TRANSPORT")).toBe("Courses");
  });
});

describe("getAllCategories", () => {
  it("returns all categories including Autre", () => {
    const categories = getAllCategories();
    expect(categories).toContain("Courses");
    expect(categories).toContain("Transport");
    expect(categories).toContain("Logement");
    expect(categories).toContain("Santé");
    expect(categories).toContain("Restauration");
    expect(categories).toContain("Shopping");
    expect(categories).toContain("Loisirs");
    expect(categories).toContain("Banque");
    expect(categories).toContain("Salaire");
    expect(categories).toContain("Virements");
    expect(categories).toContain("Autre");
  });

  it("returns sorted categories", () => {
    const categories = getAllCategories();
    expect(categories).toEqual([...categories].sort());
  });
});

describe("CATEGORY_RULES", () => {
  it("has all expected categories", () => {
    const categories = CATEGORY_RULES.map(r => r.category);
    expect(categories).toContain("Courses");
    expect(categories).toContain("Transport");
    expect(categories).toContain("Logement");
    expect(categories).toContain("Santé");
    expect(categories).toContain("Restauration");
    expect(categories).toContain("Shopping");
    expect(categories).toContain("Loisirs");
    expect(categories).toContain("Banque");
    expect(categories).toContain("Salaire");
    expect(categories).toContain("Virements");
  });

  it("each rule has at least one keyword", () => {
    for (const rule of CATEGORY_RULES) {
      expect(rule.keywords.length).toBeGreaterThan(0);
    }
  });
});