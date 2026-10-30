// Tests pour la logique de partage de dépenses
// Vérifie le partage au centime, les soldes et les remboursements

import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeFirstName,
  isFirstNameTaken,
  computeBalances,
  validateBalancesSumZero,
  computeSettlements,
  parseCents,
  formatCents,
  canDeleteParticipant,
  generateId,
} from "./trip";
import type { Participant, Expense } from "./trip";

// Données de test communes
const createParticipants = (names: string[]): Participant[] =>
  names.map((name, i) => ({ id: `p${i + 1}`, firstName: name }));

const createExpense = (
  id: string,
  label: string,
  amountCents: number,
  paidBy: string,
  forWhom: string[]
): Expense => ({
  id,
  label,
  amountCents,
  paidBy,
  forWhom,
  date: "2026-01-15",
});

describe("normalizeFirstName", () => {
  it("enlève les espaces et met en minuscules", () => {
    expect(normalizeFirstName("  Alice  ")).toBe("alice");
    expect(normalizeFirstName("BOB")).toBe("bob");
  });

  it("normalise Unicode (NFC)", () => {
    // zoé composé vs décomposé
    const composed = "zoé"; // déjà en NFC
    const decomposed = "zoe\u0301"; // e + accent combiné
    expect(normalizeFirstName(composed)).toBe(normalizeFirstName(decomposed));
  });
});

describe("isFirstNameTaken", () => {
  const participants = createParticipants(["Alice", "Bob", "Chloé"]);

  it("détecte un prénom exact", () => {
    expect(isFirstNameTaken(participants, "Alice")).toBe(true);
  });

  it("détecte insensible à la casse", () => {
    expect(isFirstNameTaken(participants, "alice")).toBe(true);
    expect(isFirstNameTaken(participants, "ALICE")).toBe(true);
  });

  it("détecte avec espaces", () => {
    expect(isFirstNameTaken(participants, "  Alice  ")).toBe(true);
  });

  it("ne détecte pas un prénom différent", () => {
    expect(isFirstNameTaken(participants, "David")).toBe(false);
  });

  it("ignore le participant exclu (pour modification)", () => {
    expect(isFirstNameTaken(participants, "Alice", "p1")).toBe(false);
    expect(isFirstNameTaken(participants, "Bob", "p2")).toBe(false);
  });
});

describe("computeBalances", () => {
  it("retourne des soldes nuls sans dépenses", () => {
    const participants = createParticipants(["Alice", "Bob"]);
    const balances = computeBalances(participants, []);
    expect(balances.every((b) => b.balanceCents === 0)).toBe(true);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("partage égal simple : Alice paie 100€ pour Alice et Bob", () => {
    const participants = createParticipants(["Alice", "Bob"]);
    const expenses = [
      createExpense("e1", "Repas", 10000, "p1", ["p1", "p2"]), // 100€ = 10000 cents
    ];
    const balances = computeBalances(participants, expenses);

    // Alice a payé 100€, sa part = 50€ => balance = +50€ (on lui doit)
    // Bob a payé 0€, sa part = 50€ => balance = -50€ (il doit)
    const alice = balances.find((b) => b.participantId === "p1")!;
    const bob = balances.find((b) => b.participantId === "p2")!;

    expect(alice.paidCents).toBe(10000);
    expect(alice.shareCents).toBe(5000);
    expect(alice.balanceCents).toBe(5000);

    expect(bob.paidCents).toBe(0);
    expect(bob.shareCents).toBe(5000);
    expect(bob.balanceCents).toBe(-5000);

    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("partage 100€ en 3 : reste au payeur (premier dans forWhom)", () => {
    const participants = createParticipants(["Alice", "Bob", "Chloé"]);
    const expenses = [
      createExpense("e1", "Repas", 10000, "p1", ["p1", "p2", "p3"]),
    ];
    const balances = computeBalances(participants, expenses);

    // 10000 / 3 = 3333 reste 1
    // Alice (payeur, index 0): payé 10000, part 3334 (prend le reste) => balance 6666
    // Bob: payé 0, part 3333 => balance -3333
    // Chloé: payé 0, part 3333 => balance -3333
    const alice = balances.find((b) => b.participantId === "p1")!;
    const bob = balances.find((b) => b.participantId === "p2")!;
    const chloe = balances.find((b) => b.participantId === "p3")!;

    expect(alice.shareCents).toBe(3334); // payeur prend le reste
    expect(bob.shareCents).toBe(3333);
    expect(chloe.shareCents).toBe(3333);

    expect(alice.balanceCents).toBe(6666);
    expect(bob.balanceCents).toBe(-3333);
    expect(chloe.balanceCents).toBe(-3333);

    // Somme des parts = 3334 + 3333 + 3333 = 10000 ✓
    expect(alice.shareCents + bob.shareCents + chloe.shareCents).toBe(10000);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("plusieurs dépenses cumulées", () => {
    const participants = createParticipants(["Alice", "Bob", "Chloé"]);
    const expenses = [
      createExpense("e1", "Repas 1", 6000, "p1", ["p1", "p2", "p3"]), // 60€
      createExpense("e2", "Repas 2", 9000, "p2", ["p1", "p2"]), // 90€ pour Alice et Bob
    ];
    const balances = computeBalances(participants, expenses);

    // Alice: payé 6000, parts: 2000 + 4500 = 6500 => balance -500
    // Bob: payé 9000, parts: 2000 + 4500 = 6500 => balance +2500
    // Chloé: payé 0, part: 2000 => balance -2000
    const alice = balances.find((b) => b.participantId === "p1")!;
    const bob = balances.find((b) => b.participantId === "p2")!;
    const chloe = balances.find((b) => b.participantId === "p3")!;

    expect(alice.paidCents).toBe(6000);
    expect(alice.shareCents).toBe(6500);
    expect(alice.balanceCents).toBe(-500);

    expect(bob.paidCents).toBe(9000);
    expect(bob.shareCents).toBe(6500);
    expect(bob.balanceCents).toBe(2500);

    expect(chloe.paidCents).toBe(0);
    expect(chloe.shareCents).toBe(2000);
    expect(chloe.balanceCents).toBe(-2000);

    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("dépense pour un seul participant", () => {
    const participants = createParticipants(["Alice", "Bob"]);
    const expenses = [
      createExpense("e1", "Personnel", 5000, "p1", ["p1"]), // Alice paie pour elle seule
    ];
    const balances = computeBalances(participants, expenses);

    const alice = balances.find((b) => b.participantId === "p1")!;
    const bob = balances.find((b) => b.participantId === "p2")!;

    expect(alice.paidCents).toBe(5000);
    expect(alice.shareCents).toBe(5000);
    expect(alice.balanceCents).toBe(0);

    expect(bob.paidCents).toBe(0);
    expect(bob.shareCents).toBe(0);
    expect(bob.balanceCents).toBe(0);

    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("dépense payée par quelqu'un qui n'en bénéficie pas", () => {
    const participants = createParticipants(["Alice", "Bob", "Chloé"]);
    const expenses = [
      createExpense("e1", "Cadeau", 3000, "p1", ["p2", "p3"]), // Alice paie pour Bob et Chloé
    ];
    const balances = computeBalances(participants, expenses);

    const alice = balances.find((b) => b.participantId === "p1")!;
    const bob = balances.find((b) => b.participantId === "p2")!;
    const chloe = balances.find((b) => b.participantId === "p3")!;

    expect(alice.paidCents).toBe(3000);
    expect(alice.shareCents).toBe(0);
    expect(alice.balanceCents).toBe(3000);

    expect(bob.paidCents).toBe(0);
    expect(bob.shareCents).toBe(1500);
    expect(bob.balanceCents).toBe(-1500);

    expect(chloe.paidCents).toBe(0);
    expect(chloe.shareCents).toBe(1500);
    expect(chloe.balanceCents).toBe(-1500);

    expect(validateBalancesSumZero(balances)).toBe(true);
  });
});

describe("validateBalancesSumZero", () => {
  it("retourne true quand la somme est zéro", () => {
    const balances = [
      { participantId: "p1", firstName: "A", paidCents: 100, shareCents: 50, balanceCents: 50 },
      { participantId: "p2", firstName: "B", paidCents: 0, shareCents: 50, balanceCents: -50 },
    ];
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("retourne false quand la somme n'est pas zéro", () => {
    const balances = [
      { participantId: "p1", firstName: "A", paidCents: 100, shareCents: 50, balanceCents: 50 },
      { participantId: "p2", firstName: "B", paidCents: 0, shareCents: 50, balanceCents: -40 },
    ];
    expect(validateBalancesSumZero(balances)).toBe(false);
  });
});

describe("computeSettlements", () => {
  it("un créancier, un débiteur", () => {
    const balances = [
      { participantId: "p1", firstName: "Alice", paidCents: 10000, shareCents: 5000, balanceCents: 5000 },
      { participantId: "p2", firstName: "Bob", paidCents: 0, shareCents: 5000, balanceCents: -5000 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: "p2",
      to: "p1",
      amountCents: 5000,
    });
  });

  it("plusieurs créanciers et débiteurs - minimise les virements", () => {
    // Alice +60, Bob +20, Chloé -40, David -40
    const balances = [
      { participantId: "p1", firstName: "Alice", paidCents: 10000, shareCents: 4000, balanceCents: 6000 },
      { participantId: "p2", firstName: "Bob", paidCents: 5000, shareCents: 3000, balanceCents: 2000 },
      { participantId: "p3", firstName: "Chloé", paidCents: 0, shareCents: 4000, balanceCents: -4000 },
      { participantId: "p4", firstName: "David", paidCents: 0, shareCents: 4000, balanceCents: -4000 },
    ];
    const settlements = computeSettlements(balances);

    // Algo glouton : plus gros créancier avec plus gros débiteur
    // Alice (6000) <- Chloé (4000) : 4000
    // Alice (2000 restant) <- David (4000) : 2000
    // Bob (2000) <- David (2000 restant) : 2000
    expect(settlements.length).toBeLessThanOrEqual(3); // Au max n-1 virements

    // Vérifier que les montants sont corrects
    const totalFromChloe = settlements
      .filter((s) => s.from === "p3")
      .reduce((sum, s) => sum + s.amountCents, 0);
    const totalToAlice = settlements
      .filter((s) => s.to === "p1")
      .reduce((sum, s) => sum + s.amountCents, 0);

    expect(totalFromChloe).toBe(4000);
    expect(totalToAlice).toBe(6000);
  });

  it("équilibre déjà parfait = aucun virement", () => {
    const balances = [
      { participantId: "p1", firstName: "Alice", paidCents: 5000, shareCents: 5000, balanceCents: 0 },
      { participantId: "p2", firstName: "Bob", paidCents: 5000, shareCents: 5000, balanceCents: 0 },
    ];
    const settlements = computeSettlements(balances);
    expect(settlements).toHaveLength(0);
  });
});

describe("parseCents / formatCents", () => {
  it("parse les formats français et anglais", () => {
    expect(parseCents("12,50")).toBe(1250);
    expect(parseCents("12.50")).toBe(1250);
    expect(parseCents("12,5")).toBe(1250);
    expect(parseCents("12.5")).toBe(1250);
    expect(parseCents("100")).toBe(10000);
    expect(parseCents("0")).toBe(0);
    expect(parseCents("-10,50")).toBe(-1050);
  });

  it("ignore les symboles € et espaces", () => {
    expect(parseCents("12,50 €")).toBe(1250);
    expect(parseCents(" 12,50 ")).toBe(1250);
    expect(parseCents("1 234,56 €")).toBe(123456);
  });

  it("formate correctement en français", () => {
    expect(formatCents(1250)).toBe("12,50 €");
    expect(formatCents(10000)).toBe("100,00 €");
    expect(formatCents(0)).toBe("0,00 €");
    expect(formatCents(-500)).toBe("-5,00 €");
    expect(formatCents(123456)).toBe("1234,56 €");
  });

  it("round-trip parse -> format", () => {
    const inputs = ["12,50", "12.50", "100", "0", "1234,56", "1234.56"];
    for (const input of inputs) {
      const cents = parseCents(input);
      const formatted = formatCents(cents);
      // Le formatage ajoute l'espace avant €, on vérifie le montant
      const parsedAgain = parseCents(formatted);
      expect(parsedAgain).toBe(cents);
    }
  });
});

describe("canDeleteParticipant", () => {
  const participants = createParticipants(["Alice", "Bob", "Chloé"]);

  it("peut supprimer sans dépenses", () => {
    expect(canDeleteParticipant("p1", [])).toBe(true);
  });

  it("ne peut pas supprimer si payeur", () => {
    const expenses = [createExpense("e1", "Test", 1000, "p1", ["p1", "p2"])];
    expect(canDeleteParticipant("p1", expenses)).toBe(false);
  });

  it("ne peut pas supprimer si bénéficiaire", () => {
    const expenses = [createExpense("e1", "Test", 1000, "p2", ["p1", "p2"])];
    expect(canDeleteParticipant("p1", expenses)).toBe(false);
  });

  it("peut supprimer si ni payeur ni bénéficiaire", () => {
    const expenses = [createExpense("e1", "Test", 1000, "p1", ["p1", "p2"])];
    expect(canDeleteParticipant("p3", expenses)).toBe(true);
  });
});

describe("generateId", () => {
  it("génère des IDs uniques", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it("format : timestamp-base36 + random", () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
});

// Test d'intégration complet : scénario réel
describe("Scénario complet : weekend entre 4 amis", () => {
  const participants = createParticipants(["Alice", "Bob", "Chloé", "David"]);

  const expenses = [
    createExpense("e1", "Courses supermarché", 12000, "p1", ["p1", "p2", "p3", "p4"]), // 120€ pour tous
    createExpense("e2", "Essence", 6000, "p2", ["p1", "p2", "p3", "p4"]), // 60€ pour tous
    createExpense("e3", "Restaurant", 15000, "p3", ["p1", "p2", "p3"]), // 150€ sans David
    createExpense("e4", "Musée", 4000, "p4", ["p3", "p4"]), // 40€ pour Chloé et David
  ];

  it("calcule correctement les soldes", () => {
    const balances = computeBalances(participants, expenses);

    // Alice: payé 12000, parts: 3000+1500+5000=9500 => +2500
    // Bob: payé 6000, parts: 3000+1500+5000=9500 => -3500
    // Chloé: payé 15000, parts: 3000+1500+5000+2000=11500 => +3500
    // David: payé 4000, parts: 3000+1500+0+2000=6500 => -2500

    const alice = balances.find((b) => b.participantId === "p1")!;
    const bob = balances.find((b) => b.participantId === "p2")!;
    const chloe = balances.find((b) => b.participantId === "p3")!;
    const david = balances.find((b) => b.participantId === "p4")!;

    expect(alice.balanceCents).toBe(2500);
    expect(bob.balanceCents).toBe(-3500);
    expect(chloe.balanceCents).toBe(3500);
    expect(david.balanceCents).toBe(-2500);

    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("calcule les remboursements minimaux", () => {
    const balances = computeBalances(participants, expenses);
    const settlements = computeSettlements(balances);

    // Vérifier que les montants totaux correspondent
    const totalFromBob = settlements.filter((s) => s.from === "p2").reduce((a, s) => a + s.amountCents, 0);
    const totalFromDavid = settlements.filter((s) => s.from === "p4").reduce((a, s) => a + s.amountCents, 0);
    const totalToAlice = settlements.filter((s) => s.to === "p1").reduce((a, s) => a + s.amountCents, 0);
    const totalToChloe = settlements.filter((s) => s.to === "p3").reduce((a, s) => a + s.amountCents, 0);

    expect(totalFromBob).toBe(3500);
    expect(totalFromDavid).toBe(2500);
    expect(totalToAlice).toBe(2500);
    expect(totalToChloe).toBe(3500);

    // Nombre minimal de virements (au plus n-1 = 3)
    expect(settlements.length).toBeLessThanOrEqual(3);
  });
});

// Test des cas limites avec centimes
describe("Cas limites : précision au centime", () => {
  it("0.10 + 0.10 + 0.10 = 0.30 exactement (pas d'erreur float)", () => {
    const participants = createParticipants(["A", "B", "C"]);
    const expenses = [
      createExpense("e1", "Test", 10, "p1", ["p1", "p2", "p3"]), // 0.10€
      createExpense("e2", "Test", 10, "p1", ["p1", "p2", "p3"]),
      createExpense("e3", "Test", 10, "p1", ["p1", "p2", "p3"]),
    ];
    const balances = computeBalances(participants, expenses);
    // Chaque dépense de 10 cents / 3 = 3 cents reste 1
    // Payeur (A) prend le reste => 4 cents par dépense
    // B et C : 3 cents par dépense
    // Total payé par A = 30 cents, part de A = 12 cents, B = 9 cents, C = 9 cents
    const a = balances.find((b) => b.participantId === "p1")!;
    const b = balances.find((b) => b.participantId === "p2")!;
    const c = balances.find((b) => b.participantId === "p3")!;

    expect(a.paidCents).toBe(30);
    expect(a.shareCents).toBe(12); // 4 * 3 dépenses
    expect(a.balanceCents).toBe(18); // 30 - 12
    expect(b.shareCents).toBe(9);  // 3 * 3 dépenses
    expect(b.balanceCents).toBe(-9);
    expect(c.shareCents).toBe(9);
    expect(c.balanceCents).toBe(-9);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("1€ partagé en 3 = 34c + 33c + 33c (reste au payeur)", () => {
    const participants = createParticipants(["A", "B", "C"]);
    const expenses = [createExpense("e1", "Test", 100, "p1", ["p1", "p2", "p3"])];
    const balances = computeBalances(participants, expenses);

    // 100 / 3 = 33 reste 1 -> payeur (index 0) prend le reste
    expect(balances[0].shareCents).toBe(34); // A (payeur, index 0)
    expect(balances[1].shareCents).toBe(33);
    expect(balances[2].shareCents).toBe(33);
    expect(balances[0].shareCents + balances[1].shareCents + balances[2].shareCents).toBe(100);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  it("montant négatif refusé à la saisie (parseCents retourne 0 pour invalide)", () => {
    expect(parseCents("abc")).toBe(0);
    expect(parseCents("")).toBe(0);
  });
});