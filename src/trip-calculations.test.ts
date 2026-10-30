// Tests pour le partage de dépenses : partage au centime, soldes, remboursements.

import { describe, it, expect } from "vitest";

// Copie des fonctions de calcul pour les tester indépendamment du store

type Participant = { id: string; name: string };
type Expense = { id: string; label: string; amount: number; paidBy: string; splitAmong: string[] };
type Balance = { participantId: string; name: string; paid: number; share: number; balance: number };
type Settlement = { from: string; to: string; amount: number; fromName: string; toName: string };

/** Calcule les soldes (version testable sans store). */
function computeBalances(participants: Participant[], expenses: Expense[]): Balance[] {
  if (participants.length === 0) return [];

  const paidBy = new Map<string, number>();
  for (const p of participants) paidBy.set(p.id, 0);

  for (const expense of expenses) {
    const current = paidBy.get(expense.paidBy) ?? 0;
    paidBy.set(expense.paidBy, current + expense.amount);
  }

  const shareBy = new Map<string, number>();
  for (const p of participants) shareBy.set(p.id, 0);

  for (const expense of expenses) {
    const splitAmong = expense.splitAmong.length > 0 ? expense.splitAmong : participants.map((p) => p.id);
    const count = splitAmong.length;
    if (count === 0) continue;

    const quotient = Math.floor(expense.amount / count);
    const remainder = expense.amount % count;

    for (const pid of splitAmong) {
      const current = shareBy.get(pid) ?? 0;
      shareBy.set(pid, current + quotient);
    }
    for (let i = 0; i < remainder; i++) {
      const pid = splitAmong[i];
      const current = shareBy.get(pid) ?? 0;
      shareBy.set(pid, current + 1);
    }
  }

  const balances: Balance[] = [];
  for (const p of participants) {
    const paid = paidBy.get(p.id) ?? 0;
    const share = shareBy.get(p.id) ?? 0;
    balances.push({
      participantId: p.id,
      name: p.name,
      paid,
      share,
      balance: paid - share,
    });
  }

  return balances;
}

/** Calcule les remboursements minimaux (version testable). */
function computeSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, balance: -b.balance }));

  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const amount = Math.min(creditor.balance, debtor.balance);

    settlements.push({
      from: debtor.participantId,
      to: creditor.participantId,
      amount,
      fromName: debtor.name,
      toName: creditor.name,
    });

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance === 0) ci++;
    if (debtor.balance === 0) di++;
  }

  return settlements;
}

/** Vérifie que les remboursements équilibrent tout. */
function verifySettlements(balances: Balance[], settlements: Settlement[]): boolean {
  const finalBalances = new Map<string, number>();

  for (const b of balances) {
    finalBalances.set(b.participantId, b.balance);
  }

  for (const s of settlements) {
    const fromBal = finalBalances.get(s.from) ?? 0;
    const toBal = finalBalances.get(s.to) ?? 0;
    finalBalances.set(s.from, fromBal + s.amount);
    finalBalances.set(s.to, toBal - s.amount);
  }

  for (const bal of finalBalances.values()) {
    if (bal !== 0) return false;
  }
  return true;
}

describe("Partage de dépenses - Calculs", () => {
  // Participants de test
  const participants: Participant[] = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
  ];

  describe("Partage au centime près", () => {
    it("devrait diviser 100 centimes entre 3 personnes : 33, 33, 34", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Test", amount: 100, paidBy: "1", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      // Alice a payé 100, sa part = 34, solde = +66
      // Bob n'a rien payé, sa part = 33, solde = -33
      // Charlie n'a rien payé, sa part = 33, solde = -33
      expect(balances.find((b) => b.name === "Alice")?.share).toBe(34);
      expect(balances.find((b) => b.name === "Bob")?.share).toBe(33);
      expect(balances.find((b) => b.name === "Charlie")?.share).toBe(33);

      // Somme des parts = 100
      const totalShares = balances.reduce((sum, b) => sum + b.share, 0);
      expect(totalShares).toBe(100);
    });

    it("devrait diviser 30 centimes entre 3 personnes : 10, 10, 10", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Test", amount: 30, paidBy: "1", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      expect(balances.find((b) => b.name === "Alice")?.share).toBe(10);
      expect(balances.find((b) => b.name === "Bob")?.share).toBe(10);
      expect(balances.find((b) => b.name === "Charlie")?.share).toBe(10);

      const totalShares = balances.reduce((sum, b) => sum + b.share, 0);
      expect(totalShares).toBe(30);
    });

    it("devrait diviser 100 centimes entre 2 personnes : 50, 50", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Test", amount: 100, paidBy: "1", splitAmong: ["1", "2"] },
      ];
      const balances = computeBalances(participants.slice(0, 2), expenses);

      expect(balances.find((b) => b.name === "Alice")?.share).toBe(50);
      expect(balances.find((b) => b.name === "Bob")?.share).toBe(50);

      const totalShares = balances.reduce((sum, b) => sum + b.share, 0);
      expect(totalShares).toBe(100);
    });

    it("devrait gérer le partage par défaut (tous les participants) quand splitAmong est vide", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Test", amount: 100, paidBy: "1", splitAmong: [] },
      ];
      const balances = computeBalances(participants, expenses);

      // Même résultat que splitAmong explicite
      expect(balances.find((b) => b.name === "Alice")?.share).toBe(34);
      expect(balances.find((b) => b.name === "Bob")?.share).toBe(33);
      expect(balances.find((b) => b.name === "Charlie")?.share).toBe(33);
    });

    it("devrait répartir le reste sur les premiers participants", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Test", amount: 101, paidBy: "1", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      // 101 / 3 = 33 reste 2 -> Alice: 35, Bob: 34, Charlie: 33 (Alice et Bob reçoivent le reste)
      // Mais notre algorithme donne le reste aux premiers de la liste
      expect(balances.find((b) => b.name === "Alice")?.share).toBe(34); // 33 + 1 (reste)
      expect(balances.find((b) => b.name === "Bob")?.share).toBe(34); // 33 + 1 (reste)
      expect(balances.find((b) => b.name === "Charlie")?.share).toBe(33);

      const totalShares = balances.reduce((sum, b) => sum + b.share, 0);
      expect(totalShares).toBe(101);
    });
  });

  describe("Calcul des soldes", () => {
    it("la somme des soldes doit toujours être 0", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Courses", amount: 5000, paidBy: "1", splitAmong: ["1", "2", "3"] },
        { id: "e2", label: "Restaurant", amount: 3000, paidBy: "2", splitAmong: ["1", "2", "3"] },
        { id: "e3", label: "Essence", amount: 2000, paidBy: "3", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      const sum = balances.reduce((acc, b) => acc + b.balance, 0);
      expect(sum).toBe(0);
    });

    it("solde positif = à recevoir, négatif = à payer", () => {
      // Alice paye tout, partage à 3
      const expenses: Expense[] = [
        { id: "e1", label: "Total", amount: 9000, paidBy: "1", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      const alice = balances.find((b) => b.name === "Alice")!;
      const bob = balances.find((b) => b.name === "Bob")!;
      const charlie = balances.find((b) => b.name === "Charlie")!;

      // Alice a payé 9000, sa part = 3000, solde = +6000 (à recevoir)
      expect(alice.balance).toBe(6000);
      expect(alice.balance).toBeGreaterThan(0);

      // Bob a payé 0, sa part = 3000, solde = -3000 (à payer)
      expect(bob.balance).toBe(-3000);
      expect(bob.balance).toBeLessThan(0);

      // Charlie a payé 0, sa part = 3000, solde = -3000 (à payer)
      expect(charlie.balance).toBe(-3000);
      expect(charlie.balance).toBeLessThan(0);
    });

    it("devrait calculer correctement avec plusieurs dépenses", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Courses", amount: 3000, paidBy: "1", splitAmong: ["1", "2", "3"] },
        { id: "e2", label: "Restaurant", amount: 3000, paidBy: "2", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      // Alice: payé 3000, part = 2000 (1000+1000), solde = +1000
      // Bob: payé 3000, part = 2000, solde = +1000
      // Charlie: payé 0, part = 2000, solde = -2000
      expect(balances.find((b) => b.name === "Alice")?.balance).toBe(1000);
      expect(balances.find((b) => b.name === "Bob")?.balance).toBe(1000);
      expect(balances.find((b) => b.name === "Charlie")?.balance).toBe(-2000);

      const sum = balances.reduce((acc, b) => acc + b.balance, 0);
      expect(sum).toBe(0);
    });

    it("devrait gérer une seule dépense pour un seul participant", () => {
      const singleParticipant: Participant[] = [{ id: "1", name: "Alice" }];
      const expenses: Expense[] = [
        { id: "e1", label: "Solo", amount: 1000, paidBy: "1", splitAmong: ["1"] },
      ];
      const balances = computeBalances(singleParticipant, expenses);

      expect(balances[0].paid).toBe(1000);
      expect(balances[0].share).toBe(1000);
      expect(balances[0].balance).toBe(0);
    });

    it("devrait gérer le partage entre un sous-ensemble de participants", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Dîner", amount: 3000, paidBy: "1", splitAmong: ["1", "2"] }, // Alice et Bob seulement
      ];
      const balances = computeBalances(participants, expenses);

      // Alice: payé 3000, part = 1500, solde = +1500
      // Bob: payé 0, part = 1500, solde = -1500
      // Charlie: payé 0, part = 0, solde = 0
      expect(balances.find((b) => b.name === "Alice")?.balance).toBe(1500);
      expect(balances.find((b) => b.name === "Bob")?.balance).toBe(-1500);
      expect(balances.find((b) => b.name === "Charlie")?.balance).toBe(0);

      const sum = balances.reduce((acc, b) => acc + b.balance, 0);
      expect(sum).toBe(0);
    });
  });

  describe("Remboursements minimaux", () => {
    it("devrait générer le nombre minimal de virements (n-1 au max)", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 9000, share: 3000, balance: 6000 },
        { participantId: "2", name: "Bob", paid: 0, share: 3000, balance: -3000 },
        { participantId: "3", name: "Charlie", paid: 0, share: 3000, balance: -3000 },
      ];
      const settlements = computeSettlements(balances);

      // Au maximum 2 virements pour 3 personnes
      expect(settlements.length).toBeLessThanOrEqual(2);
      expect(settlements.length).toBeGreaterThan(0);
    });

    it("devrait faire payer les débiteurs aux créanciers", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 9000, share: 3000, balance: 6000 },
        { participantId: "2", name: "Bob", paid: 0, share: 3000, balance: -3000 },
        { participantId: "3", name: "Charlie", paid: 0, share: 3000, balance: -3000 },
      ];
      const settlements = computeSettlements(balances);

      // Vérifier que Bob et Charlie paient vers Alice
      for (const s of settlements) {
        expect(s.toName).toBe("Alice");
        expect(["Bob", "Charlie"]).toContain(s.fromName);
      }
    });

    it("les remboursements doivent équilibrer tout le monde", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 9000, share: 3000, balance: 6000 },
        { participantId: "2", name: "Bob", paid: 0, share: 3000, balance: -3000 },
        { participantId: "3", name: "Charlie", paid: 0, share: 3000, balance: -3000 },
      ];
      const settlements = computeSettlements(balances);

      const isValid = verifySettlements(balances, settlements);
      expect(isValid).toBe(true);
    });

    it("devrait fonctionner avec plusieurs créanciers et débiteurs", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 5000, share: 2000, balance: 3000 },
        { participantId: "2", name: "Bob", paid: 5000, share: 2000, balance: 3000 },
        { participantId: "3", name: "Charlie", paid: 0, share: 3000, balance: -3000 },
        { participantId: "4", name: "David", paid: 0, share: 3000, balance: -3000 },
      ];
      const settlements = computeSettlements(balances);

      const isValid = verifySettlements(balances, settlements);
      expect(isValid).toBe(true);

      // Maximum 3 virements pour 4 personnes
      expect(settlements.length).toBeLessThanOrEqual(3);
    });

    it("devrait ne générer aucun virement si tout est équilibré", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 3000, share: 3000, balance: 0 },
        { participantId: "2", name: "Bob", paid: 3000, share: 3000, balance: 0 },
        { participantId: "3", name: "Charlie", paid: 3000, share: 3000, balance: 0 },
      ];
      const settlements = computeSettlements(balances);

      expect(settlements.length).toBe(0);
    });

    it("devrait gérer le cas où un créancier reçoit de plusieurs débiteurs", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 10000, share: 2500, balance: 7500 },
        { participantId: "2", name: "Bob", paid: 0, share: 2500, balance: -2500 },
        { participantId: "3", name: "Charlie", paid: 0, share: 2500, balance: -2500 },
        { participantId: "4", name: "David", paid: 0, share: 2500, balance: -2500 },
      ];
      const settlements = computeSettlements(balances);

      // Alice doit recevoir 2500 de chacun
      expect(settlements.length).toBe(3);
      for (const s of settlements) {
        expect(s.toName).toBe("Alice");
        expect(s.amount).toBe(2500);
      }

      const isValid = verifySettlements(balances, settlements);
      expect(isValid).toBe(true);
    });

    it("devrait gérer le cas où un débiteur paie plusieurs créanciers", () => {
      const balances: Balance[] = [
        { participantId: "1", name: "Alice", paid: 2500, share: 2500, balance: 0 },
        { participantId: "2", name: "Bob", paid: 10000, share: 2500, balance: 7500 },
        { participantId: "3", name: "Charlie", paid: 0, share: 5000, balance: -5000 },
        { participantId: "4", name: "David", paid: 0, share: 2500, balance: -2500 },
      ];
      const settlements = computeSettlements(balances);

      const isValid = verifySettlements(balances, settlements);
      expect(isValid).toBe(true);
    });
  });

  describe("Cas limites", () => {
    it("devrait gérer montant zéro", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Gratuit", amount: 0, paidBy: "1", splitAmong: ["1", "2", "3"] },
      ];
      const balances = computeBalances(participants, expenses);

      expect(balances.every((b) => b.balance === 0)).toBe(true);
    });

    it("devrait gérer un seul participant", () => {
      const solo: Participant[] = [{ id: "1", name: "Alice" }];
      const expenses: Expense[] = [
        { id: "e1", label: "Solo", amount: 5000, paidBy: "1", splitAmong: ["1"] },
      ];
      const balances = computeBalances(solo, expenses);

      expect(balances[0].balance).toBe(0);
      const settlements = computeSettlements(balances);
      expect(settlements.length).toBe(0);
    });

    it("devrait gérer des dépenses sans participant (liste vide)", () => {
      const expenses: Expense[] = [];
      const balances = computeBalances(participants, expenses);

      expect(balances.length).toBe(3);
      expect(balances.every((b) => b.balance === 0)).toBe(true);
    });
  });
});