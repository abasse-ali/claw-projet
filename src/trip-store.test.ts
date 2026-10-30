// Tests automatisés pour le partage au centime, les soldes et les remboursements.

import { describe, it, expect } from "vitest";
import {
  computeBalances,
  computeSettlements,
  validateBalances,
  type Participant,
  type Expense,
  type Settlement,
} from "./trip-store";

// Helpers pour créer des participants et dépenses de test
const createParticipant = (id: string, name: string): Participant => ({ id, name });
const createExpense = (
  id: string,
  label: string,
  amount: number,
  paidBy: string,
  forWhom: string[],
  date = "2026-10-28"
): Expense => ({ id, label, amount, paidBy, forWhom, date });

describe("computeBalances", () => {
  it("divise équitablement 100€ entre 3 personnes (33.33, 33.33, 33.34)", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
    ];
    const expenses = [
      createExpense("e1", "Restaurant", 10000, "1", ["1", "2", "3"]), // 100€ en centimes
    ];

    const balances = computeBalances(participants, expenses);

    // Alice a payé 100€, sa part est 33.34 (premier reste), solde = 100 - 33.34 = 66.66
    // Bob part = 33.33, solde = -33.33
    // Charlie part = 33.33, solde = -33.33
    expect(balances.get("1")).toBe(6666); // 66.66€
    expect(balances.get("2")).toBe(-3333); // -33.33€
    expect(balances.get("3")).toBe(-3333); // -33.33€
  });

  it("trois lignes de 0.10€ font exactement 0.30€", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
    ];
    const expenses = [
      createExpense("e1", "Item 1", 10, "1", ["1", "2"]), // 0.10€
      createExpense("e2", "Item 2", 10, "1", ["1", "2"]), // 0.10€
      createExpense("e3", "Item 3", 10, "1", ["1", "2"]), // 0.10€
    ];

    const balances = computeBalances(participants, expenses);

    // Alice a payé 0.30€, part = 0.15€ chacun, solde = 0.30 - 0.15 = 0.15€
    // Bob part = 0.15€, solde = -0.15€
    expect(balances.get("1")).toBe(15); // 0.15€
    expect(balances.get("2")).toBe(-15); // -0.15€
  });

  it("partage avec 'tout le monde' (forWhom vide) inclut tous les participants", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
    ];
    const expenses = [
      createExpense("e1", "Courses", 3000, "1", []), // 30€ pour tout le monde
    ];

    const balances = computeBalances(participants, expenses);

    // Alice a payé 30€, part = 10€ chacun
    // Alice solde = 30 - 10 = 20€
    // Bob solde = -10€
    // Charlie solde = -10€
    expect(balances.get("1")).toBe(2000);
    expect(balances.get("2")).toBe(-1000);
    expect(balances.get("3")).toBe(-1000);
  });

  it("partage seulement pour certains participants", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
    ];
    const expenses = [
      createExpense("e1", "Taxi", 2000, "1", ["1", "2"]), // 20€ seulement pour Alice et Bob
    ];

    const balances = computeBalances(participants, expenses);

    // Alice a payé 20€, part = 10€ chacun (juste Alice et Bob)
    // Alice solde = 20 - 10 = 10€
    // Bob solde = -10€
    // Charlie solde = 0€ (pas concerné)
    expect(balances.get("1")).toBe(1000);
    expect(balances.get("2")).toBe(-1000);
    expect(balances.get("3")).toBe(0);
  });

  it("plusieurs dépenses s'additionnent correctement", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
    ];
    const expenses = [
      createExpense("e1", "Déjeuner", 4000, "1", ["1", "2"]), // 40€ payé par Alice
      createExpense("e2", "Dîner", 6000, "2", ["1", "2"]), // 60€ payé par Bob
    ];

    const balances = computeBalances(participants, expenses);

    // Alice: payé 40, part 20+30=50, solde = -10
    // Bob: payé 60, part 20+30=50, solde = +10
    expect(balances.get("1")).toBe(-1000);
    expect(balances.get("2")).toBe(1000);
  });

  it("la somme des soldes fait toujours 0", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
      createParticipant("4", "David"),
    ];
    const expenses = [
      createExpense("e1", "Restaurant", 12345, "1", ["1", "2", "3"]),
      createExpense("e2", "Taxi", 5678, "2", ["1", "2"]),
      createExpense("e3", "Musée", 9999, "3", []),
      createExpense("e4", "Glace", 450, "4", ["3", "4"]),
    ];

    const balances = computeBalances(participants, expenses);
    expect(validateBalances(balances)).toBe(true);
  });

  it("gère un montant zéro", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
    ];
    const expenses = [
      createExpense("e1", "Gratuit", 0, "1", ["1", "2"]),
    ];

    const balances = computeBalances(participants, expenses);
    expect(balances.get("1")).toBe(0);
    expect(balances.get("2")).toBe(0);
    expect(validateBalances(balances)).toBe(true);
  });

  it("distribue le reste correctement (premiers participants prennent le centime en plus)", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
    ];
    // 10€ = 1000 centimes / 3 = 333 avec reste 1
    const expenses = [
      createExpense("e1", "Test", 1000, "1", ["1", "2", "3"]),
    ];

    const balances = computeBalances(participants, expenses);

    // Alice a payé 1000, part = 334 (premier = reste), solde = 1000 - 334 = 666
    // Bob part = 333, solde = -333
    // Charlie part = 333, solde = -333
    expect(balances.get("1")).toBe(666);
    expect(balances.get("2")).toBe(-333);
    expect(balances.get("3")).toBe(-333);
    expect(validateBalances(balances)).toBe(true);
  });
});

describe("computeSettlements", () => {
  it("un seul virement quand une personne doit à une autre", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
    ];
    const balances = new Map<string, number>([
      ["1", 1000], // Alice doit recevoir 10€
      ["2", -1000], // Bob doit payer 10€
    ]);

    const settlements = computeSettlements(participants, balances);

    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({ from: "2", to: "1", amount: 1000 });
  });

  it("minimise le nombre de virements avec plusieurs créanciers et débiteurs", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
      createParticipant("4", "David"),
    ];
    const balances = new Map<string, number>([
      ["1", 5000], // Alice +50€
      ["2", 3000], // Bob +30€
      ["3", -4000], // Charlie -40€
      ["4", -4000], // David -40€
    ]);

    const settlements = computeSettlements(participants, balances);

    // Charlie paie 40 à Alice (reste 10 à Alice)
    // David paie 10 à Alice et 30 à Bob
    // Total: 3 virements (optimal)
    expect(settlements.length).toBeLessThanOrEqual(3);
    
    // Vérifier que les montants s'équilibrent
    const aliceReceived = settlements.filter(s => s.to === "1").reduce((sum, s) => sum + s.amount, 0);
    const bobReceived = settlements.filter(s => s.to === "2").reduce((sum, s) => sum + s.amount, 0);
    const charliePaid = settlements.filter(s => s.from === "3").reduce((sum, s) => sum + s.amount, 0);
    const davidPaid = settlements.filter(s => s.from === "4").reduce((sum, s) => sum + s.amount, 0);
    
    expect(aliceReceived).toBe(5000);
    expect(bobReceived).toBe(3000);
    expect(charliePaid).toBe(4000);
    expect(davidPaid).toBe(4000);
  });

  it("équilibre correctement avec 3 participants (cas classique)", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
    ];
    const balances = new Map<string, number>([
      ["1", 3000], // Alice +30€
      ["2", -1000], // Bob -10€
      ["3", -2000], // Charlie -20€
    ]);

    const settlements = computeSettlements(participants, balances);

    expect(settlements).toHaveLength(2);
    // Bob paie 10 à Alice, Charlie paie 20 à Alice
    const amounts = settlements.map(s => s.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([1000, 2000]);
  });

  it("retourne un tableau vide si tous les soldes sont à 0", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
    ];
    const balances = new Map<string, number>([
      ["1", 0],
      ["2", 0],
    ]);

    const settlements = computeSettlements(participants, balances);
    expect(settlements).toHaveLength(0);
  });

  it("les virements remboursent exactement les soldes", () => {
    const participants = [
      createParticipant("1", "Alice"),
      createParticipant("2", "Bob"),
      createParticipant("3", "Charlie"),
    ];
    const balances = new Map<string, number>([
      ["1", 7000],
      ["2", -3000],
      ["3", -4000],
    ]);

    const settlements = computeSettlements(participants, balances);

    // Recalculer les soldes après virements
    const finalBalances = new Map<string, number>([
      ["1", 7000],
      ["2", -3000],
      ["3", -4000],
    ]);

    for (const s of settlements) {
      finalBalances.set(s.from, (finalBalances.get(s.from) || 0) + s.amount);
      finalBalances.set(s.to, (finalBalances.get(s.to) || 0) - s.amount);
    }

    // Tous doivent être à 0
    for (const amount of finalBalances.values()) {
      expect(amount).toBe(0);
    }
  });
});

describe("validateBalances", () => {
  it("retourne true quand la somme est 0", () => {
    const balances = new Map<string, number>([
      ["1", 100],
      ["2", -50],
      ["3", -50],
    ]);
    expect(validateBalances(balances)).toBe(true);
  });

  it("retourne false quand la somme n'est pas 0", () => {
    const balances = new Map<string, number>([
      ["1", 100],
      ["2", -50],
      ["3", -40], // somme = 10
    ]);
    expect(validateBalances(balances)).toBe(false);
  });
});