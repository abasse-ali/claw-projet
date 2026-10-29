import { describe, it, expect } from "vitest";
import { computeBalances, computeSettlements, validateBalances } from "./types";
import type { Participant, Expense, Balance } from "./types";

describe("Partage des dépenses - calculs", () => {
  // Participants de test
  const participants: Participant[] = [
    { id: "alice", name: "Alice" },
    { id: "bob", name: "Bob" },
    { id: "charlie", name: "Charlie" },
  ];

  describe("computeBalances", () => {
    it("devrait calculer les soldes correctement pour un partage égal", () => {
      const expenses: Expense[] = [
        {
          id: "e1",
          label: "Restaurant",
          amount: 3000, // 30,00 €
          paidBy: "alice",
          sharedWith: [], // tout le monde
          date: "2024-01-15",
        },
      ];

      const balances = computeBalances(participants, expenses);

      expect(balances).toHaveLength(3);
      
      // Alice a payé 3000, sa part = 1000 (3000/3), solde = +2000
      const alice = balances.find(b => b.participantId === "alice")!;
      expect(alice.paid).toBe(3000);
      expect(alice.share).toBe(1000);
      expect(alice.balance).toBe(2000);

      // Bob n'a rien payé, sa part = 1000, solde = -1000
      const bob = balances.find(b => b.participantId === "bob")!;
      expect(bob.paid).toBe(0);
      expect(bob.share).toBe(1000);
      expect(bob.balance).toBe(-1000);

      // Charlie n'a rien payé, sa part = 1000, solde = -1000
      const charlie = balances.find(b => b.participantId === "charlie")!;
      expect(charlie.paid).toBe(0);
      expect(charlie.share).toBe(1000);
      expect(charlie.balance).toBe(-1000);

      // La somme des soldes doit être 0
      expect(validateBalances(balances)).toBe(true);
    });

    it("devrait gérer le reste de la division au centime près (3 personnes, 100€)", () => {
      const expenses: Expense[] = [
        {
          id: "e1",
          label: "Courses",
          amount: 10000, // 100,00 €
          paidBy: "alice",
          sharedWith: [],
          date: "2024-01-15",
        },
      ];

      const balances = computeBalances(participants, expenses);

      // 10000 / 3 = 3333 avec reste 1
      // Alice: payé 10000, part 3334 (3333 + 1), solde = +6666
      const alice = balances.find(b => b.participantId === "alice")!;
      expect(alice.share).toBe(3334);
      expect(alice.balance).toBe(6666);

      // Bob: part 3333, solde = -3333
      const bob = balances.find(b => b.participantId === "bob")!;
      expect(bob.share).toBe(3333);
      expect(bob.balance).toBe(-3333);

      // Charlie: part 3333, solde = -3333
      const charlie = balances.find(b => b.participantId === "charlie")!;
      expect(charlie.share).toBe(3333);
      expect(charlie.balance).toBe(-3333);

      // Somme = 6666 - 3333 - 3333 = 0
      expect(validateBalances(balances)).toBe(true);
    });

    it("devrait partager seulement entre certains participants", () => {
      const expenses: Expense[] = [
        {
          id: "e1",
          label: "Essence",
          amount: 6000, // 60,00 €
          paidBy: "alice",
          sharedWith: ["alice", "bob"], // seulement Alice et Bob
          date: "2024-01-15",
        },
      ];

      const balances = computeBalances(participants, expenses);

      // Alice: payé 6000, part 3000, solde = +3000
      const alice = balances.find(b => b.participantId === "alice")!;
      expect(alice.paid).toBe(6000);
      expect(alice.share).toBe(3000);
      expect(alice.balance).toBe(3000);

      // Bob: payé 0, part 3000, solde = -3000
      const bob = balances.find(b => b.participantId === "bob")!;
      expect(bob.paid).toBe(0);
      expect(bob.share).toBe(3000);
      expect(bob.balance).toBe(-3000);

      // Charlie: pas concerné
      const charlie = balances.find(b => b.participantId === "charlie")!;
      expect(charlie.paid).toBe(0);
      expect(charlie.share).toBe(0);
      expect(charlie.balance).toBe(0);

      expect(validateBalances(balances)).toBe(true);
    });

    it("devrait gérer plusieurs dépenses", () => {
      const expenses: Expense[] = [
        {
          id: "e1",
          label: "Restaurant",
          amount: 3000,
          paidBy: "alice",
          sharedWith: [],
          date: "2024-01-15",
        },
        {
          id: "e2",
          label: "Essence",
          amount: 6000,
          paidBy: "bob",
          sharedWith: ["alice", "bob"],
          date: "2024-01-16",
        },
      ];

      const balances = computeBalances(participants, expenses);

      // Alice: payé 3000, part = 1000 (e1) + 3000 (e2) = 4000, solde = -1000
      const alice = balances.find(b => b.participantId === "alice")!;
      expect(alice.paid).toBe(3000);
      expect(alice.share).toBe(4000);
      expect(alice.balance).toBe(-1000);

      // Bob: payé 6000, part = 1000 (e1) + 3000 (e2) = 4000, solde = +2000
      const bob = balances.find(b => b.participantId === "bob")!;
      expect(bob.paid).toBe(6000);
      expect(bob.share).toBe(4000);
      expect(bob.balance).toBe(2000);

      // Charlie: payé 0, part = 1000 (e1), solde = -1000
      const charlie = balances.find(b => b.participantId === "charlie")!;
      expect(charlie.paid).toBe(0);
      expect(charlie.share).toBe(1000);
      expect(charlie.balance).toBe(-1000);

      expect(validateBalances(balances)).toBe(true);
    });

    it("devrait gérer des montants négatifs (remboursements) - bien que ce ne soit pas le cas d'usage", () => {
      const expenses: Expense[] = [
        {
          id: "e1",
          label: "Remboursement",
          amount: -1000, // -10,00 €
          paidBy: "alice",
          sharedWith: [],
          date: "2024-01-15",
        },
      ];

      const balances = computeBalances(participants, expenses);

      const alice = balances.find(b => b.participantId === "alice")!;
      expect(alice.paid).toBe(-1000);
      // -1000 / 3 = -333 avec reste -1
      // Le reste est distribué aux premiers participants
      // En fait, JavaScript: Math.floor(-1000/3) = -334, -1000 % 3 = -1
      // Donc: part = -334 + (-1 pour le premier) = -335 pour Alice
      // Bob: -334, Charlie: -334
      expect(alice.share).toBe(-334); // Math.floor(-1000/3) = -334
      expect(alice.balance).toBe(-1000 - (-334)); // -666
    });
  });

  describe("computeSettlements", () => {
    it("devrait calculer les remboursements minimaux (cas simple)", () => {
      const balances: Balance[] = [
        { participantId: "alice", participantName: "Alice", paid: 3000, share: 1000, balance: 2000 },
        { participantId: "bob", participantName: "Bob", paid: 0, share: 1000, balance: -1000 },
        { participantId: "charlie", participantName: "Charlie", paid: 0, share: 1000, balance: -1000 },
      ];

      const settlements = computeSettlements(balances);

      // Alice est créancière de 2000, Bob et Charlie sont débiteurs de 1000 chacun
      // Il faut 2 virements: Bob -> Alice (1000) et Charlie -> Alice (1000)
      expect(settlements).toHaveLength(2);
      
      const bobToAlice = settlements.find(s => s.from === "bob" && s.to === "alice");
      expect(bobToAlice).toBeDefined();
      expect(bobToAlice?.amount).toBe(1000);

      const charlieToAlice = settlements.find(s => s.from === "charlie" && s.to === "alice");
      expect(charlieToAlice).toBeDefined();
      expect(charlieToAlice?.amount).toBe(1000);
    });

    it("devrait minimiser le nombre de virements (cas chaîné)", () => {
      const balances: Balance[] = [
        { participantId: "alice", participantName: "Alice", paid: 5000, share: 1000, balance: 4000 },
        { participantId: "bob", participantName: "Bob", paid: 2000, share: 2000, balance: 0 },
        { participantId: "charlie", participantName: "Charlie", paid: 0, share: 1000, balance: -1000 },
        { participantId: "david", participantName: "David", paid: 0, share: 3000, balance: -3000 },
      ];

      const settlements = computeSettlements(balances);

      // Alice +4000, Charlie -1000, David -3000, Bob 0
      // Charlie -> Alice: 1000
      // David -> Alice: 3000
      // Total 2 virements (optimal)
      expect(settlements).toHaveLength(2);
      
      expect(settlements.some(s => s.from === "charlie" && s.to === "alice" && s.amount === 1000)).toBe(true);
      expect(settlements.some(s => s.from === "david" && s.to === "alice" && s.amount === 3000)).toBe(true);
    });

    it("devrait retourner un tableau vide si tout est équilibré", () => {
      const balances: Balance[] = [
        { participantId: "alice", participantName: "Alice", paid: 1000, share: 1000, balance: 0 },
        { participantId: "bob", participantName: "Bob", paid: 1000, share: 1000, balance: 0 },
      ];

      const settlements = computeSettlements(balances);
      expect(settlements).toHaveLength(0);
    });

    it("devrait gérer le cas où un créancier paie plusieurs débiteurs", () => {
      const balances: Balance[] = [
        { participantId: "alice", participantName: "Alice", paid: 10000, share: 2000, balance: 8000 },
        { participantId: "bob", participantName: "Bob", paid: 0, share: 3000, balance: -3000 },
        { participantId: "charlie", participantName: "Charlie", paid: 0, share: 3000, balance: -3000 },
        { participantId: "david", participantName: "David", paid: 0, share: 2000, balance: -2000 },
      ];

      const settlements = computeSettlements(balances);

      // Alice +8000, Bob -3000, Charlie -3000, David -2000
      // Algorithme glouton: plus gros créancier avec plus gros débiteur
      // Bob -> Alice: 3000, Charlie -> Alice: 3000, David -> Alice: 2000
      expect(settlements).toHaveLength(3);
      expect(settlements.reduce((sum, s) => sum + s.amount, 0)).toBe(8000);
    });
  });

  describe("validateBalances", () => {
    it("devrait retourner true si la somme des soldes est 0", () => {
      const balances: Balance[] = [
        { participantId: "a", participantName: "A", paid: 1000, share: 500, balance: 500 },
        { participantId: "b", participantName: "B", paid: 0, share: 500, balance: -500 },
      ];
      expect(validateBalances(balances)).toBe(true);
    });

    it("devrait retourner false si la somme des soldes n'est pas 0", () => {
      const balances: Balance[] = [
        { participantId: "a", participantName: "A", paid: 1000, share: 500, balance: 500 },
        { participantId: "b", participantName: "B", paid: 0, share: 400, balance: -400 },
      ];
      expect(validateBalances(balances)).toBe(false);
    });
  });

  describe("Cas limites et précisions", () => {
    it("devrait gérer 3 lignes de 0,10€ (total 0,30€ exactement)", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Item 1", amount: 10, paidBy: "alice", sharedWith: [], date: "2024-01-01" },
        { id: "e2", label: "Item 2", amount: 10, paidBy: "alice", sharedWith: [], date: "2024-01-02" },
        { id: "e3", label: "Item 3", amount: 10, paidBy: "alice", sharedWith: [], date: "2024-01-03" },
      ];

      const balances = computeBalances(participants, expenses);
      // Chaque dépense de 10 centimes / 3 = 3 avec reste 1
      // Le reste va au premier participant (Alice) pour chaque dépense
      // Alice payé 30, part = 4+4+4 = 12, solde = 18
      // Bob part = 3+3+3 = 9, solde = -9
      // Charlie part = 3+3+3 = 9, solde = -9
      
      expect(validateBalances(balances)).toBe(true);
      const alice = balances.find(b => b.participantId === "alice")!;
      expect(alice.balance).toBe(18);
      const bob = balances.find(b => b.participantId === "bob")!;
      expect(bob.balance).toBe(-9);
      const charlie = balances.find(b => b.participantId === "charlie")!;
      expect(charlie.balance).toBe(-9);
    });

    it("devrait gérer le partage de 100€ entre 3 (33,33 + 33,33 + 33,34)", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Total", amount: 10000, paidBy: "alice", sharedWith: [], date: "2024-01-01" },
      ];

      const balances = computeBalances(participants, expenses);
      
      // Le reste (10000 % 3 = 1) va au premier participant (Alice)
      const alice = balances.find(b => b.participantId === "alice")!;
      const bob = balances.find(b => b.participantId === "bob")!;
      const charlie = balances.find(b => b.participantId === "charlie")!;
      
      expect(alice.share).toBe(3334); // 3333 + 1
      expect(bob.share).toBe(3333);
      expect(charlie.share).toBe(3333);
      expect(alice.share + bob.share + charlie.share).toBe(10000);
      expect(validateBalances(balances)).toBe(true);
    });

    it("devrait gérer un montant nul", () => {
      const expenses: Expense[] = [
        { id: "e1", label: "Gratuit", amount: 0, paidBy: "alice", sharedWith: [], date: "2024-01-01" },
      ];

      const balances = computeBalances(participants, expenses);
      
      expect(validateBalances(balances)).toBe(true);
      balances.forEach(b => {
        expect(b.paid).toBe(0);
        expect(b.share).toBe(0);
        expect(b.balance).toBe(0);
      });
    });
  });
});