// Tests pour la logique de calcul (centimes, soldes, remboursements)

import { describe, it, expect, vi } from "vitest";
import {
  parseAmountToCents,
  formatCents,
  formatSignedCents,
  computeBalances,
  computeSettlements,
  validateBalances,
  normalizeName,
  isNameTaken,
  generateId,
  today,
  computeTotalExpenses,
} from "./calculations";
import type { Participant, Expense, TripData, Balance, Settlement } from "./types";

describe("parseAmountToCents", () => {
  it("parse les montants avec virgule", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
    expect(parseAmountToCents("0,10")).toBe(10);
    expect(parseAmountToCents("100,00")).toBe(10000);
  });

  it("parse les montants avec point", () => {
    expect(parseAmountToCents("12.50")).toBe(1250);
    expect(parseAmountToCents("0.10")).toBe(10);
    expect(parseAmountToCents("100.00")).toBe(10000);
  });

  it("parse les montants sans décimales", () => {
    expect(parseAmountToCents("100")).toBe(10000);
    expect(parseAmountToCents("5")).toBe(500);
  });

  it("gère les séparateurs de milliers", () => {
    expect(parseAmountToCents("1 235,15")).toBe(123515);
    expect(parseAmountToCents("1,235.15")).toBe(123515);
    expect(parseAmountToCents("10 000")).toBe(1000000);
  });

  it("ignore le symbole euro", () => {
    expect(parseAmountToCents("12,50 €")).toBe(1250);
    expect(parseAmountToCents("€ 12,50")).toBe(1250);
    expect(parseAmountToCents("12,50eur")).toBe(1250);
  });

  it("arrondit au centime près (HALF_UP)", () => {
    expect(parseAmountToCents("2,665")).toBe(267); // 2.665 -> 2.67
    expect(parseAmountToCents("2,664")).toBe(266); // 2.664 -> 2.66
    expect(parseAmountToCents("0,005")).toBe(1);   // 0.005 -> 0.01
  });

  it("retourne 0 pour entrées invalides", () => {
    expect(parseAmountToCents("")).toBe(0);
    expect(parseAmountToCents("abc")).toBe(0);
    expect(parseAmountToCents("12,50,30")).toBe(0); // deux séparateurs décimaux
    expect(parseAmountToCents("-")).toBe(0);
  });

  it("test des 3 lignes de 0,10 = 0,30 exactement", () => {
    const sum = parseAmountToCents("0,10") + parseAmountToCents("0,10") + parseAmountToCents("0,10");
    expect(sum).toBe(30); // 30 centimes = 0,30 €
  });

  it("test 100 split en 3 = 33,33 + 33,33 + 33,34", () => {
    const total = parseAmountToCents("100");
    const baseShare = Math.floor(total / 3);
    const remainder = total % 3;
    expect(baseShare).toBe(3333);
    expect(remainder).toBe(1);
    // 3333 + 3333 + 3334 = 10000
    expect(baseShare * 2 + (baseShare + remainder)).toBe(10000);
  });
});

describe("formatCents", () => {
  it("formate correctement les centimes positifs", () => {
    expect(formatCents(1250)).toBe("12,50 €");
    expect(formatCents(10000)).toBe("100,00 €");
    expect(formatCents(123515)).toBe("1 235,15 €");
  });

  it("formate correctement les centimes négatifs", () => {
    expect(formatCents(-1250)).toBe("−12,50 €");
    expect(formatCents(-100)).toBe("−1,00 €");
  });

  it("formate zéro", () => {
    expect(formatCents(0)).toBe("0,00 €");
  });
});

describe("formatSignedCents", () => {
  it("formate avec signe positif", () => {
    expect(formatSignedCents(1250)).toBe("+12,50 €");
    expect(formatSignedCents(100)).toBe("+1,00 €");
  });

  it("formate avec signe négatif", () => {
    expect(formatSignedCents(-1250)).toBe("−12,50 €");
    expect(formatSignedCents(-100)).toBe("−1,00 €");
  });

  it("formate zéro sans signe", () => {
    expect(formatSignedCents(0)).toBe("0,00 €");
  });
});

describe("normalizeName", () => {
  it("normalise les noms (trim, lowercase, NFC)", () => {
    expect(normalizeName("  Zoé  ")).toBe("zoé");
    expect(normalizeName("ZOÉ")).toBe("zoé");
    expect(normalizeName("zoé")).toBe("zoé");
  });

  it("gère la normalisation Unicode", () => {
    // "Zoe\u0301" est la forme décomposée de "Zoé"
    expect(normalizeName("Zoe\u0301")).toBe("zoé");
    expect(normalizeName("Zoé")).toBe("zoé");
    expect(normalizeName("Zoe\u0301")).toBe(normalizeName("Zoé"));
  });
});

describe("isNameTaken", () => {
  const participants: Participant[] = [
    { id: "1", name: "Zoé" },
    { id: "2", name: "Alice" },
    { id: "3", name: "Bob" },
  ];

  it("détecte les doublons insensibles à la casse", () => {
    expect(isNameTaken(participants, "zoé")).toBe(true);
    expect(isNameTaken(participants, "ZOÉ")).toBe(true);
    expect(isNameTaken(participants, "  zoé  ")).toBe(true);
    expect(isNameTaken(participants, "alice")).toBe(true);
  });

  it("n'est pas pris pour des noms différents", () => {
    expect(isNameTaken(participants, "Charlie")).toBe(false);
    expect(isNameTaken(participants, "zoe")).toBe(false); // sans accent
  });

  it("exclut un ID lors de la modification", () => {
    expect(isNameTaken(participants, "Zoé", "1")).toBe(false); // même ID = OK
    expect(isNameTaken(participants, "Zoé", "2")).toBe(true); // autre ID = pris
  });
});

describe("computeBalances", () => {
  const createTrip = (participants: Participant[], expenses: Expense[]): TripData => ({
    participants,
    expenses,
  });

  it("calcule les soldes simples : un payeur, tous partagent", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Charlie" },
    ];

    const expenses: Expense[] = [
      { id: "e1", label: "Restaurant", amount: 3000, paidBy: "1", sharedWith: [], date: today() },
    ];

    const balances = computeBalances(createTrip(participants, expenses));
    
    // Alice a payé 3000, sa part = 1000, balance = +2000
    // Bob part = 1000, balance = -1000
    // Charlie part = 1000, balance = -1000
    expect(balances.find(b => b.participantId === "1")?.balance).toBe(2000);
    expect(balances.find(b => b.participantId === "2")?.balance).toBe(-1000);
    expect(balances.find(b => b.participantId === "3")?.balance).toBe(-1000);
    
    // Somme des soldes = 0
    expect(validateBalances(balances)).toBe(true);
  });

  it("calcule les soldes avec partage partiel", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Charlie" },
    ];

    const expenses: Expense[] = [
      { id: "e1", label: "Essence", amount: 6000, paidBy: "1", sharedWith: ["1", "2"], date: today() },
    ];

    const balances = computeBalances(createTrip(participants, expenses));
    
    // Alice a payé 6000, sa part = 3000, balance = +3000
    // Bob part = 3000, balance = -3000
    // Charlie pas concerné, balance = 0
    expect(balances.find(b => b.participantId === "1")?.balance).toBe(3000);
    expect(balances.find(b => b.participantId === "2")?.balance).toBe(-3000);
    expect(balances.find(b => b.participantId === "3")?.balance).toBe(0);
    
    expect(validateBalances(balances)).toBe(true);
  });

  it("gère le centime qui ne se divise pas (100€ / 3)", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Charlie" },
    ];

    const expenses: Expense[] = [
      { id: "e1", label: "Total", amount: 10000, paidBy: "1", sharedWith: [], date: today() },
    ];

    const balances = computeBalances(createTrip(participants, expenses));
    
    // 10000 / 3 = 3333 reste 1
    // Alice payé 10000, part 3334 (premier = prend le reste), balance = 6666
    // Bob part 3333, balance = -3333
    // Charlie part 3333, balance = -3333
    // Total = 6666 - 3333 - 3333 = 0
    expect(balances.find(b => b.participantId === "1")?.share).toBe(3334);
    expect(balances.find(b => b.participantId === "2")?.share).toBe(3333);
    expect(balances.find(b => b.participantId === "3")?.share).toBe(3333);
    expect(validateBalances(balances)).toBe(true);
  });

  it("plusieurs dépenses, plusieurs payeurs", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
      { id: "3", name: "Charlie" },
    ];

    const expenses: Expense[] = [
      { id: "e1", label: "Restau", amount: 3000, paidBy: "1", sharedWith: [], date: today() },
      { id: "e2", label: "Essence", amount: 6000, paidBy: "2", sharedWith: [], date: today() },
    ];

    const balances = computeBalances(createTrip(participants, expenses));
    
    // Alice: payé 3000, part (3000+6000)/3 = 3000, balance = 0
    // Bob: payé 6000, part 3000, balance = +3000
    // Charlie: payé 0, part 3000, balance = -3000
    expect(balances.find(b => b.participantId === "1")?.balance).toBe(0);
    expect(balances.find(b => b.participantId === "2")?.balance).toBe(3000);
    expect(balances.find(b => b.participantId === "3")?.balance).toBe(-3000);
    
    expect(validateBalances(balances)).toBe(true);
  });

  it("somme des soldes toujours à 0", () => {
    // Test avec beaucoup de participants et dépenses aléatoires
    const participants: Participant[] = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: `P${i + 1}` }));
    
    const expenses: Expense[] = [
      { id: "e1", label: "A", amount: 12345, paidBy: "1", sharedWith: [], date: today() },
      { id: "e2", label: "B", amount: 6789, paidBy: "2", sharedWith: ["1", "2", "3"], date: today() },
      { id: "e3", label: "C", amount: 5000, paidBy: "5", sharedWith: ["4", "5"], date: today() },
    ];

    const balances = computeBalances(createTrip(participants, expenses));
    expect(validateBalances(balances)).toBe(true);
  });
});

describe("computeSettlements", () => {
  const createBalance = (overrides: Partial<Balance> = {}): Balance => ({
    participantId: "1",
    participantName: "Test",
    paid: 0,
    share: 0,
    balance: 0,
    ...overrides,
  });

  it("retourne vide si tout est équilibré", () => {
    const balances: Balance[] = [
      createBalance({ participantId: "1", participantName: "Alice", balance: 0 }),
      createBalance({ participantId: "2", participantName: "Bob", balance: 0 }),
    ];
    expect(computeSettlements(balances)).toEqual([]);
  });

  it("un débiteur, un créditeur", () => {
    const balances: Balance[] = [
      createBalance({ participantId: "1", participantName: "Alice", balance: 1000 }),
      createBalance({ participantId: "2", participantName: "Bob", balance: -1000 }),
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: "2",
      fromName: "Bob",
      to: "1",
      toName: "Alice",
      amount: 1000,
    });
  });

  it("plusieurs débiteurs, un créditeur", () => {
    const balances: Balance[] = [
      createBalance({ participantId: "1", participantName: "Alice", balance: 3000 }),
      createBalance({ participantId: "2", participantName: "Bob", balance: -1000 }),
      createBalance({ participantId: "3", participantName: "Charlie", balance: -2000 }),
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(2);
    // Bob paie 1000 à Alice, Charlie paie 2000 à Alice
    expect(settlements.some(s => s.from === "2" && s.to === "1" && s.amount === 1000)).toBe(true);
    expect(settlements.some(s => s.from === "3" && s.to === "1" && s.amount === 2000)).toBe(true);
  });

  it("un débiteur, plusieurs créditeurs", () => {
    const balances: Balance[] = [
      createBalance({ participantId: "1", participantName: "Alice", balance: 1000 }),
      createBalance({ participantId: "2", participantName: "Bob", balance: 2000 }),
      createBalance({ participantId: "3", participantName: "Charlie", balance: -3000 }),
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(2);
    // Charlie paie 2000 à Bob (le plus gros créancier), puis 1000 à Alice
    expect(settlements.some(s => s.from === "3" && s.to === "2" && s.amount === 2000)).toBe(true);
    expect(settlements.some(s => s.from === "3" && s.to === "1" && s.amount === 1000)).toBe(true);
  });

  it("plusieurs débiteurs, plusieurs créditeurs - minimum de transactions", () => {
    const balances: Balance[] = [
      createBalance({ participantId: "1", participantName: "Alice", balance: 5000 }),
      createBalance({ participantId: "2", participantName: "Bob", balance: 3000 }),
      createBalance({ participantId: "3", participantName: "Charlie", balance: -4000 }),
      createBalance({ participantId: "4", participantName: "David", balance: -4000 }),
    ];
    const settlements = computeSettlements(balances);
    
    // Le minimum de transactions = nombre de participants non-équilibrés - 1 (si possible)
    // Ici 4 personnes non-équilibrées, minimum 3 transactions
    expect(settlements.length).toBeLessThanOrEqual(3);
    
    // Vérifier que les montants correspondent
    const totalFrom = settlements.reduce((sum, s) => sum + s.amount, 0);
    const totalTo = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalFrom).toBe(totalTo);
    expect(totalFrom).toBe(8000); // 4000 + 4000
  });

  it("préserve la somme des soldes à 0 après règlements", () => {
      const balances: Balance[] = [
        createBalance({ participantId: "1", participantName: "Alice", balance: 5000 }),
        createBalance({ participantId: "2", participantName: "Bob", balance: -2000 }),
        createBalance({ participantId: "3", participantName: "Charlie", balance: -3000 }),
      ];
      const settlements = computeSettlements(balances);

      // Simuler les règlements
      const finalBalances = balances.map((b) => {
        const outgoing = settlements
          .filter((s) => s.from === b.participantId)
          .reduce((sum, s) => sum + s.amount, 0);
        const incoming = settlements
          .filter((s) => s.to === b.participantId)
          .reduce((sum, s) => sum + s.amount, 0);
        // Ce qui est payé augmente le solde (vers 0), ce qui est reçu le diminue (vers 0)
        return { ...b, balance: b.balance + outgoing - incoming };
      });

      // Après règlements, tous les soldes devraient être 0
      finalBalances.forEach((b) => {
        expect(b.balance).toBe(0);
      });
    });
});

describe("validateBalances", () => {
  it("valide des soldes équilibrés", () => {
    const balances: Balance[] = [
      { participantId: "1", participantName: "A", paid: 1000, share: 500, balance: 500 },
      { participantId: "2", participantName: "B", paid: 500, share: 1000, balance: -500 },
    ];
    expect(validateBalances(balances)).toBe(true);
  });

  it("rejette des soldes non équilibrés", () => {
    const balances: Balance[] = [
      { participantId: "1", participantName: "A", paid: 1000, share: 500, balance: 500 },
      { participantId: "2", participantName: "B", paid: 500, share: 1000, balance: -400 }, // erreur
    ];
    expect(validateBalances(balances)).toBe(false);
  });
});

describe("computeTotalExpenses", () => {
  it("calcule le total des dépenses", () => {
    const expenses: Expense[] = [
      { id: "1", label: "A", amount: 1000, paidBy: "1", sharedWith: [], date: today() },
      { id: "2", label: "B", amount: 2000, paidBy: "2", sharedWith: [], date: today() },
      { id: "3", label: "C", amount: 3000, paidBy: "1", sharedWith: [], date: today() },
    ];
    expect(computeTotalExpenses(expenses)).toBe(6000);
  });

  it("retourne 0 pour liste vide", () => {
    expect(computeTotalExpenses([])).toBe(0);
  });
});

describe("generateId", () => {
  it("génère des IDs uniques", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("today", () => {
  it("retourne une date au format ISO", () => {
    const date = today();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});