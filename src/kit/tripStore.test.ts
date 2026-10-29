// Tests pour le partage de dépenses au centime, les soldes et les remboursements.

import { describe, it, expect } from "vitest";
import {
  computeBalances,
  computeSettlements,
  formatCents,
  parseCents,
  type Participant,
  type Expense,
} from "./tripStore";

const participants: Participant[] = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "charlie", name: "Charlie" },
];

describe("parseCents / formatCents", () => {
  it("parse les montants avec virgule", () => {
    expect(parseCents("12,34")).toBe(1234);
    expect(parseCents("100")).toBe(10000);
    expect(parseCents("0,10")).toBe(10);
  });

  it("parse les montants avec point", () => {
    expect(parseCents("12.34")).toBe(1234);
    expect(parseCents("100.00")).toBe(10000);
  });

  it("formate correctement en euros", () => {
    expect(formatCents(1234)).toBe("12,34 €");
    expect(formatCents(10000)).toBe("100,00 €");
    expect(formatCents(-500)).toBe("-5,00 €");
    expect(formatCents(0)).toBe("0,00 €");
  });

  it("round-trip parse -> format", () => {
    expect(formatCents(parseCents("12,34"))).toBe("12,34 €");
    expect(formatCents(parseCents("100"))).toBe("100,00 €");
    expect(formatCents(parseCents("0,10"))).toBe("0,10 €");
  });
});

describe("computeBalances - partage au centime près", () => {
  it("trois lignes de 0,10 € = 0,30 € exactement", () => {
    const expenses: Expense[] = [
      { id: "1", label: "Café", amount: 10, paidBy: "alice", forWhom: [] },
      { id: "2", label: "Thé", amount: 10, paidBy: "alice", forWhom: [] },
      { id: "3", label: "Eau", amount: 10, paidBy: "alice", forWhom: [] },
    ];
    const balances = computeBalances(participants, expenses);
    // Chaque dépense de 10 centimes partagée en 3 = 3 + 3 + 4 (reste au premier bénéficiaire = Alice)
    // Alice: +10 - 4 = +6 par dépense × 3 = +18
    // Bob: -3 par dépense × 3 = -9
    // Charlie: -3 par dépense × 3 = -9
    expect(balances.get("alice")).toBe(18);
    expect(balances.get("bob")).toBe(-9);
    expect(balances.get("charlie")).toBe(-9);
    // Somme = 0
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("100 € partagé en 3 = 33,33 + 33,33 + 33,34", () => {
    const expenses: Expense[] = [
      { id: "1", label: "Restaurant", amount: 10000, paidBy: "alice", forWhom: [] },
    ];
    const balances = computeBalances(participants, expenses);
    // 10000 / 3 = 3333 reste 1
    // Alice: +10000 - 3334 = 6666
    // Bob: -3333
    // Charlie: -3333
    expect(balances.get("alice")).toBe(6666);
    expect(balances.get("bob")).toBe(-3333);
    expect(balances.get("charlie")).toBe(-3333);
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("reste distribué aux premiers bénéficiaires", () => {
    // 10 centimes pour 3 personnes = 3 + 3 + 4 (le reste va au premier)
    const expenses: Expense[] = [
      { id: "1", label: "Test", amount: 10, paidBy: "alice", forWhom: [] },
    ];
    const balances = computeBalances(participants, expenses);
    expect(balances.get("alice")).toBe(6); // +10 - 4
    expect(balances.get("bob")).toBe(-3);
    expect(balances.get("charlie")).toBe(-3);
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("dépense pour un sous-groupe seulement", () => {
    const expenses: Expense[] = [
      { id: "1", label: "Taxi", amount: 3000, paidBy: "alice", forWhom: ["alice", "bob"] },
    ];
    const balances = computeBalances(participants, expenses);
    // Alice et Bob partagent : 1500 chacun
    // Alice: +3000 - 1500 = 1500
    // Bob: -1500
    // Charlie: 0
    expect(balances.get("alice")).toBe(1500);
    expect(balances.get("bob")).toBe(-1500);
    expect(balances.get("charlie")).toBe(0);
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("plusieurs dépenses, soldes s'additionnent", () => {
    const expenses: Expense[] = [
      { id: "1", label: "Déjeuner", amount: 6000, paidBy: "alice", forWhom: [] }, // 2000 chacun
      { id: "2", label: "Dîner", amount: 9000, paidBy: "bob", forWhom: [] }, // 3000 chacun
    ];
    const balances = computeBalances(participants, expenses);
    // Alice: +6000 - 2000 - 3000 = +1000
    // Bob: -2000 + 9000 - 3000 = +4000
    // Charlie: -2000 - 3000 = -5000
    expect(balances.get("alice")).toBe(1000);
    expect(balances.get("bob")).toBe(4000);
    expect(balances.get("charlie")).toBe(-5000);
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  it("montant zéro", () => {
    const expenses: Expense[] = [
      { id: "1", label: "Gratuit", amount: 0, paidBy: "alice", forWhom: [] },
    ];
    const balances = computeBalances(participants, expenses);
    expect(balances.get("alice")).toBe(0);
    expect(balances.get("bob")).toBe(0);
    expect(balances.get("charlie")).toBe(0);
  });

  it("participant qui n'est dans aucune dépense a solde 0", () => {
    const expenses: Expense[] = [
      { id: "1", label: "Taxi", amount: 1000, paidBy: "alice", forWhom: ["alice", "bob"] },
    ];
    const balances = computeBalances(participants, expenses);
    expect(balances.get("charlie")).toBe(0);
  });
});

describe("computeSettlements - remboursements minimaux", () => {
  it("cas simple : un créancier, un débiteur", () => {
    const balances = new Map<string, number>([
      ["alice", 1000],
      ["bob", -1000],
      ["charlie", 0],
    ]);
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "bob", to: "alice", amount: 1000 });
  });

  it("un créancier, deux débiteurs", () => {
    const balances = new Map<string, number>([
      ["alice", 5000],
      ["bob", -2000],
      ["charlie", -3000],
    ]);
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(2);
    expect(settlements).toEqual([
      { from: "charlie", to: "alice", amount: 3000 },
      { from: "bob", to: "alice", amount: 2000 },
    ]);
  });

  it("deux créanciers, un débiteur", () => {
    const balances = new Map<string, number>([
      ["alice", 3000],
      ["bob", 2000],
      ["charlie", -5000],
    ]);
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(2);
    expect(settlements).toEqual([
      { from: "charlie", to: "alice", amount: 3000 },
      { from: "charlie", to: "bob", amount: 2000 },
    ]);
  });

  it("plusieurs créanciers et débiteurs - minimise les virements", () => {
    const balances = new Map<string, number>([
      ["alice", 5000],
      ["bob", 3000],
      ["charlie", -4000],
      ["david", -4000],
    ]);
    const settlements = computeSettlements(balances);
    // Le minimum de virements est 3 (n-1 où n=4 participants non-nuls)
    expect(settlements.length).toBeLessThanOrEqual(3);
    // Vérifier que les montants sont corrects
    const aliceReceived = settlements
      .filter((s) => s.to === "alice")
      .reduce((sum, s) => sum + s.amount, 0);
    const bobReceived = settlements
      .filter((s) => s.to === "bob")
      .reduce((sum, s) => sum + s.amount, 0);
    const charliePaid = settlements
      .filter((s) => s.from === "charlie")
      .reduce((sum, s) => sum + s.amount, 0);
    const davidPaid = settlements
      .filter((s) => s.from === "david")
      .reduce((sum, s) => sum + s.amount, 0);
    expect(aliceReceived).toBe(5000);
    expect(bobReceived).toBe(3000);
    expect(charliePaid).toBe(4000);
    expect(davidPaid).toBe(4000);
  });

  it("soldes déjà à zéro = pas de virements", () => {
    const balances = new Map<string, number>([
      ["alice", 0],
      ["bob", 0],
      ["charlie", 0],
    ]);
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(0);
  });

  it("résultat déterministe (même ordre à chaque exécution)", () => {
    const balances = new Map<string, number>([
      ["alice", 5000],
      ["bob", -3000],
      ["charlie", -2000],
    ]);
    const s1 = computeSettlements(balances);
    const s2 = computeSettlements(balances);
    expect(s1).toEqual(s2);
  });
});

describe("Intégration : soldes + remboursements", () => {
  it("scénario complet : voyage à 4", () => {
    const parts: Participant[] = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
      { id: "c", name: "Charlie" },
      { id: "d", name: "David" },
    ];
    const expenses: Expense[] = [
      { id: "1", label: "Hôtel", amount: 40000, paidBy: "a", forWhom: [] }, // 10000 chacun
      { id: "2", label: "Repas", amount: 12000, paidBy: "b", forWhom: [] }, // 3000 chacun
      { id: "3", label: "Essence", amount: 8000, paidBy: "c", forWhom: ["a", "b", "c"] }, // 2667 chacun (reste à a)
      { id: "4", label: "Activité", amount: 20000, paidBy: "d", forWhom: ["b", "d"] }, // 10000 chacun
    ];

    const balances = computeBalances(parts, expenses);
    const sum = Array.from(balances.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);

    const settlements = computeSettlements(balances);
    // Vérifier que les remboursements équilibrent tout
    const finalBalances = new Map(balances);
    for (const s of settlements) {
      finalBalances.set(s.from, (finalBalances.get(s.from) || 0) + s.amount);
      finalBalances.set(s.to, (finalBalances.get(s.to) || 0) - s.amount);
    }
    for (const v of finalBalances.values()) {
      expect(v).toBe(0);
    }
  });
});