// Tests pour la logique de calcul des soldes et remboursements
import { describe, it, expect, beforeEach } from "vitest";
import {
  computeBalances,
  computeSettlements,
  verifyBalancesSumZero,
  formatCents,
  eurosToCents,
  getParticipantName,
} from "./tripStore";
import type { Participant, Expense } from "./tripStore";

const createParticipant = (id: string, name: string): Participant => ({ id, name });
const createExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "e-1",
  label: "Test",
  amountCents: 1000,
  paidBy: "p-1",
  forWhom: [],
  date: "2026-10-28",
  category: "Autre",
  ...overrides,
});

describe("formatCents", () => {
  it("formate correctement les montants positifs", () => {
    expect(formatCents(1250)).toBe("12,50 €");
    expect(formatCents(1234)).toBe("12,34 €");
    expect(formatCents(50)).toBe("0,50 €");
    expect(formatCents(1)).toBe("0,01 €");
    expect(formatCents(125000)).toBe("1\u202f250,00 €");
  });

  it("formate correctement les montants négatifs", () => {
    expect(formatCents(-1250)).toBe("−12,50 €");
    expect(formatCents(-50)).toBe("−0,50 €");
    expect(formatCents(-125000)).toBe("−1\u202f250,00 €");
  });

  it("formate zéro", () => {
    expect(formatCents(0)).toBe("0,00 €");
  });
});

describe("eurosToCents", () => {
  it("convertit correctement", () => {
    expect(eurosToCents(12.5)).toBe(1250);
    expect(eurosToCents(12.34)).toBe(1234);
    expect(eurosToCents(0.01)).toBe(1);
    expect(eurosToCents(0)).toBe(0);
  });

  it("gère les arrondis", () => {
    expect(eurosToCents(12.345)).toBe(1235);
    expect(eurosToCents(12.344)).toBe(1234);
  });
});

describe("computeBalances", () => {
  const participants: Participant[] = [
    createParticipant("p-1", "Alice"),
    createParticipant("p-2", "Bob"),
    createParticipant("p-3", "Charlie"),
  ];

  it("retourne des soldes à 0 sans dépenses", () => {
    const balances = computeBalances(participants, []);
    expect(balances.get("p-1")).toBe(0);
    expect(balances.get("p-2")).toBe(0);
    expect(balances.get("p-3")).toBe(0);
  });

  it("calcule correctement une dépense partagée entre tous", () => {
    // Alice paie 100€ pour tout le monde (3 personnes)
    const expenses = [createExpense({ amountCents: 10000, paidBy: "p-1" })];
    const balances = computeBalances(participants, expenses);

    // Alice a payé 10000, sa part = 3333, reste = 1 (va au premier participant = Alice)
    // Alice: +10000 - 3333 - 1 = +6666
    // Bob: -3333
    // Charlie: -3333
    expect(balances.get("p-1")).toBe(6666);
    expect(balances.get("p-2")).toBe(-3333);
    expect(balances.get("p-3")).toBe(-3333);
  });

  it("la somme des soldes fait toujours 0", () => {
    const expenses = [
      createExpense({ amountCents: 10000, paidBy: "p-1" }),
      createExpense({ amountCents: 5000, paidBy: "p-2" }),
      createExpense({ amountCents: 3333, paidBy: "p-3" }),
    ];
    const balances = computeBalances(participants, expenses);
    expect(verifyBalancesSumZero(balances)).toBe(true);
  });

  it("gère le partage pour un sous-groupe", () => {
    // Alice paie 60€ pour Alice et Bob seulement
    const expenses = [
      createExpense({ amountCents: 6000, paidBy: "p-1", forWhom: ["p-1", "p-2"] }),
    ];
    const balances = computeBalances(participants, expenses);

    // Alice a payé 6000, sa part = 3000, solde = +3000
    // Bob doit 3000, solde = -3000
    // Charlie n'est pas concerné, solde = 0
    expect(balances.get("p-1")).toBe(3000);
    expect(balances.get("p-2")).toBe(-3000);
    expect(balances.get("p-3")).toBe(0);
  });

  it("gère plusieurs dépenses", () => {
    const expenses = [
      createExpense({ amountCents: 10000, paidBy: "p-1" }), // Alice paie 100€ pour tous
      createExpense({ amountCents: 3000, paidBy: "p-2" }),  // Bob paie 30€ pour tous
    ];
    const balances = computeBalances(participants, expenses);

    // Dépense 1 (10000, payeur p-1): parts = 3333, reste = 1
    // p-1: +10000 - 3333 - 1 = +6666
    // p-2: -3333
    // p-3: -3333
    // Dépense 2 (3000, payeur p-2): parts = 1000, reste = 0
    // p-1: -1000
    // p-2: +3000 - 1000 = +2000
    // p-3: -1000
    // Total: p-1 = 6666 - 1000 = 5666, p-2 = -3333 + 2000 = -1333, p-3 = -3333 - 1000 = -4333
    expect(balances.get("p-1")).toBe(5666);
    expect(balances.get("p-2")).toBe(-1333);
    expect(balances.get("p-3")).toBe(-4333);
    expect(verifyBalancesSumZero(balances)).toBe(true);
  });

  it("test de partage 100€ en 3 = 33.33 + 33.33 + 33.34", () => {
    const expenses = [createExpense({ amountCents: 10000, paidBy: "p-1" })];
    const balances = computeBalances(participants, expenses);
    
    const sum = balances.get("p-1")! + balances.get("p-2")! + balances.get("p-3")!;
    expect(sum).toBe(0);
    
    // Vérifier que la répartition des centimes est correcte
    // Alice a payé 10000, chaque part = 3333, reste = 1
    // Le reste va au premier participant concerné (Alice qui est p-1)
    // Alice: +10000 - 3334 = +6666
    // Bob: -3333
    // Charlie: -3333
    expect(balances.get("p-1")).toBe(6666);
    expect(balances.get("p-2")).toBe(-3333);
    expect(balances.get("p-3")).toBe(-3333);
  });

  it("test 3 lignes de 0,10 = 0,30 exactement", () => {
    const expenses = [
      createExpense({ amountCents: 10, paidBy: "p-1" }),
      createExpense({ amountCents: 10, paidBy: "p-2" }),
      createExpense({ amountCents: 10, paidBy: "p-3" }),
    ];
    const balances = computeBalances(participants, expenses);
    expect(verifyBalancesSumZero(balances)).toBe(true);
    
    // Chaque dépense de 10 centimes partagée en 3 = 3, 3, 4
    // Vérifions juste que la somme fait 0
    let sum = 0;
    for (const v of balances.values()) sum += v;
    expect(sum).toBe(0);
  });

  it("test montant zéro", () => {
    const expenses = [createExpense({ amountCents: 0, paidBy: "p-1" })];
    const balances = computeBalances(participants, expenses);
    expect(balances.get("p-1")).toBe(0);
    expect(balances.get("p-2")).toBe(0);
    expect(balances.get("p-3")).toBe(0);
  });
});

describe("computeSettlements", () => {
  const participants: Participant[] = [
    createParticipant("p-1", "Alice"),
    createParticipant("p-2", "Bob"),
    createParticipant("p-3", "Charlie"),
  ];

  it("retourne liste vide si tous les soldes sont à 0", () => {
    const balances = new Map<string, number>([
      ["p-1", 0],
      ["p-2", 0],
      ["p-3", 0],
    ]);
    const settlements = computeSettlements(participants, balances);
    expect(settlements).toEqual([]);
  });

  it("calcule un remboursement simple", () => {
    const balances = new Map<string, number>([
      ["p-1", 1000],  // Alice doit recevoir 10€
      ["p-2", -1000], // Bob doit payer 10€
      ["p-3", 0],
    ]);
    const settlements = computeSettlements(participants, balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "p-2", to: "p-1", amountCents: 1000 });
  });

  it("minimise le nombre de virements", () => {
    // Alice +50, Bob +30, Charlie -80
    const balances = new Map<string, number>([
      ["p-1", 5000],
      ["p-2", 3000],
      ["p-3", -8000],
    ]);
    const settlements = computeSettlements(participants, balances);
    
    // Devrait faire 2 virements : Charlie -> Alice (50), Charlie -> Bob (30)
    expect(settlements).toHaveLength(2);
    expect(settlements.some(s => s.from === "p-3" && s.to === "p-1" && s.amountCents === 5000)).toBe(true);
    expect(settlements.some(s => s.from === "p-3" && s.to === "p-2" && s.amountCents === 3000)).toBe(true);
  });

  it("gère plusieurs créanciers et débiteurs", () => {
    // Alice +40, Bob +30, Charlie -20, David -50
    const participants4: Participant[] = [
      ...participants,
      createParticipant("p-4", "David"),
    ];
    const balances = new Map<string, number>([
      ["p-1", 4000],
      ["p-2", 3000],
      ["p-3", -2000],
      ["p-4", -5000],
    ]);
    const settlements = computeSettlements(participants4, balances);
    
    // Total créanciers = 7000, total débiteurs = 7000
    // Virements minimaux : 3 virements
    expect(settlements.length).toBeLessThanOrEqual(3);
    
    // Vérifier que les montants sont conservés
    let totalFrom = 0, totalTo = 0;
    for (const s of settlements) {
      totalFrom += s.amountCents;
      totalTo += s.amountCents;
    }
    expect(totalFrom).toBe(7000);
    expect(totalTo).toBe(7000);
  });

  it("préserve l'équilibre après règlements", () => {
    const balances = new Map<string, number>([
      ["p-1", 5000],
      ["p-2", -2000],
      ["p-3", -3000],
    ]);
    const settlements = computeSettlements(participants, balances);
    
    // Simuler les paiements
    const finalBalances = new Map(balances);
    for (const s of settlements) {
      finalBalances.set(s.from, (finalBalances.get(s.from) ?? 0) + s.amountCents);
      finalBalances.set(s.to, (finalBalances.get(s.to) ?? 0) - s.amountCents);
    }
    
    // Tous les soldes doivent être à 0
    for (const v of finalBalances.values()) {
      expect(v).toBe(0);
    }
  });
});

describe("getParticipantName", () => {
  const participants: Participant[] = [
    createParticipant("p-1", "Alice"),
    createParticipant("p-2", "Bob"),
  ];

  it("retourne le nom pour un ID existant", () => {
    expect(getParticipantName(participants, "p-1")).toBe("Alice");
    expect(getParticipantName(participants, "p-2")).toBe("Bob");
  });

  it("retourne 'Inconnu' pour un ID inexistant", () => {
    expect(getParticipantName(participants, "p-999")).toBe("Inconnu");
  });
});