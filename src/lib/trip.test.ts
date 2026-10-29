// Tests pour la logique métier du partage de dépenses

import {
  addParticipant,
  removeParticipant,
  addExpense,
  removeExpense,
  computeBalances,
  computeTransfers,
  validateBalancesSumZero,
  formatCents,
  parseCents,
  isDuplicateName,
  type Participant,
  type Expense,
  type TripState,
} from "./trip";

// Helper pour créer un état de test
const createTestState = (): TripState => ({
  participants: [],
  expenses: [],
});

const createParticipant = (name: string): Participant => ({
  id: `p-${name}`,
  name,
});

const createExpense = (
  label: string,
  amount: number,
  paidBy: string,
  splitBetween: string[]
): Expense => ({
  id: `e-${label}`,
  label,
  amount,
  paidBy,
  splitBetween,
  date: "2026-01-01",
});

describe("isDuplicateName", () => {
  const participants: Participant[] = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Zoé" },
  ];

  test("détecte les doublons insensibles à la casse", () => {
    expect(isDuplicateName(participants, "alice")).toBe(true);
    expect(isDuplicateName(participants, "ALICE")).toBe(true);
    expect(isDuplicateName(participants, "  alice  ")).toBe(true);
  });

  test("ne détecte pas les noms différents", () => {
    expect(isDuplicateName(participants, "Charlie")).toBe(false);
    expect(isDuplicateName(participants, "Zoe")).toBe(false); // sans accent
  });

  test("ignore le participant exclu", () => {
    expect(isDuplicateName(participants, "alice", "1")).toBe(false);
  });
});

describe("addParticipant", () => {
  test("ajoute un participant valide", () => {
    const state = createTestState();
    const newState = addParticipant(state, "Alice");
    expect(newState.participants).toHaveLength(1);
    expect(newState.participants[0].name).toBe("Alice");
  });

  test("rejette un nom vide", () => {
    const state = createTestState();
    const newState = addParticipant(state, "   ");
    expect(newState.participants).toHaveLength(0);
  });

  test("rejette un doublon", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "alice"); // doublon
    expect(state.participants).toHaveLength(1);
  });

  test("conserve l'ordre d'ajout", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    state = addParticipant(state, "Charlie");
    expect(state.participants.map(p => p.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });
});

describe("removeParticipant", () => {
  test("supprime un participant non utilisé", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    state = removeParticipant(state, state.participants[0].id);
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0].name).toBe("Bob");
  });

  test("bloque la suppression si participant a payé une dépense", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Déjeuner", 3000, aliceId, []); // 30€ payé par Alice
    const newState = removeParticipant(state, aliceId);
    expect(newState.participants).toHaveLength(2); // inchangé
  });

  test("bloque la suppression si participant dans splitBetween", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    const aliceId = state.participants[0].id;
    const bobId = state.participants[1].id;
    state = addExpense(state, "Déjeuner", 3000, aliceId, [bobId]); // partagé avec Bob seulement
    const newState = removeParticipant(state, bobId);
    expect(newState.participants).toHaveLength(2); // inchangé
  });
});

describe("addExpense", () => {
  let state: TripState;

  beforeEach(() => {
    state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    state = addParticipant(state, "Charlie");
  });

  test("ajoute une dépense simple partagée entre tous", () => {
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Déjeuner", 3000, aliceId, []); // 30€ pour tous
    expect(state.expenses).toHaveLength(1);
    expect(state.expenses[0].label).toBe("Déjeuner");
    expect(state.expenses[0].amount).toBe(3000);
    expect(state.expenses[0].splitBetween).toHaveLength(3); // tous les 3
  });

  test("ajoute une dépense partagée entre certains seulement", () => {
    const aliceId = state.participants[0].id;
    const bobId = state.participants[1].id;
    state = addExpense(state, "Taxi", 2000, aliceId, [bobId]); // 20€ pour Bob seulement
    expect(state.expenses[0].splitBetween).toHaveLength(1);
    expect(state.expenses[0].splitBetween[0]).toBe(bobId);
  });

  test("rejette une dépense sans libellé", () => {
    const aliceId = state.participants[0].id;
    state = addExpense(state, "   ", 3000, aliceId, []);
    expect(state.expenses).toHaveLength(0);
  });

  test("rejette un montant <= 0", () => {
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Test", 0, aliceId, []);
    expect(state.expenses).toHaveLength(0);
    state = addExpense(state, "Test", -100, aliceId, []);
    expect(state.expenses).toHaveLength(0);
  });

  test("rejette un payeur inexistant", () => {
    state = addExpense(state, "Test", 3000, "invalid-id", []);
    expect(state.expenses).toHaveLength(0);
  });

  test("filtre les participants invalides dans splitBetween", () => {
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Test", 3000, aliceId, [aliceId, "invalid-id"]);
    expect(state.expenses[0].splitBetween).toHaveLength(1);
    expect(state.expenses[0].splitBetween[0]).toBe(aliceId);
  });
});

describe("removeExpense", () => {
  test("supprime une dépense existante", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Déjeuner", 3000, aliceId, []);
    const expenseId = state.expenses[0].id;
    state = removeExpense(state, expenseId);
    expect(state.expenses).toHaveLength(0);
  });

  test("ne fait rien si dépense inexistante", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Déjeuner", 3000, aliceId, []);
    state = removeExpense(state, "invalid-id");
    expect(state.expenses).toHaveLength(1);
  });
});

describe("computeBalances - partage au centime près", () => {
  test("3 dépenses de 0,10€ (10 centimes) partagées entre 3 = 0,30€ total, partage correct", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    state = addParticipant(state, "Charlie");
    const aliceId = state.participants[0].id;
    
    // 3 x 10 centimes = 30 centimes
    state = addExpense(state, "Café 1", 10, aliceId, []);
    state = addExpense(state, "Café 2", 10, aliceId, []);
    state = addExpense(state, "Café 3", 10, aliceId, []);
    
    const balances = computeBalances(state);
    // Chaque dépense: 10/3 = 3 reste 1 -> Alice(4), Bob(3), Charlie(3)
    // 3 dépenses: Alice=12, Bob=9, Charlie=9
    // Alice a payé 30, sa part = 12, balance = +18
    // Bob part = 9, balance = -9
    // Charlie part = 9, balance = -9
    expect(balances[0].paid).toBe(30);
    expect(balances[0].share).toBe(12);
    expect(balances[0].balance).toBe(18);
    expect(balances[1].balance).toBe(-9);
    expect(balances[2].balance).toBe(-9);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  test("100€ partagé en 3 = 33,33 + 33,33 + 33,34 (reste distribué aux premiers)", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    state = addParticipant(state, "Charlie");
    const aliceId = state.participants[0].id;
    
    state = addExpense(state, "Repas", 10000, aliceId, []); // 100€ = 10000 centimes
    
    const balances = computeBalances(state);
    // 10000 / 3 = 3333 reste 1
    // Alice part = 3333 + 1 = 3334
    // Bob part = 3333
    // Charlie part = 3333
    // Total parts = 3334 + 3333 + 3333 = 10000 ✓
    expect(balances[0].share).toBe(3334);
    expect(balances[1].share).toBe(3333);
    expect(balances[2].share).toBe(3333);
    expect(balances[0].share + balances[1].share + balances[2].share).toBe(10000);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  test("montant non divisible : le reste est distribué aux premiers participants", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    const aliceId = state.participants[0].id;
    
    // 10 centimes partagés entre 3 (mais on a que 2 participants)
    state = addExpense(state, "Test", 10, aliceId, []);
    
    const balances = computeBalances(state);
    // 10 / 2 = 5 chacun, pas de reste
    expect(balances[0].share).toBe(5);
    expect(balances[1].share).toBe(5);
    
    // Test avec 3 participants et 10 centimes
    let state2 = createTestState();
    state2 = addParticipant(state2, "Alice");
    state2 = addParticipant(state2, "Bob");
    state2 = addParticipant(state2, "Charlie");
    const aliceId2 = state2.participants[0].id;
    state2 = addExpense(state2, "Test", 10, aliceId2, []);
    
    const balances2 = computeBalances(state2);
    // 10 / 3 = 3 reste 1
    // Alice: 3+1=4, Bob: 3, Charlie: 3
    expect(balances2[0].share).toBe(4);
    expect(balances2[1].share).toBe(3);
    expect(balances2[2].share).toBe(3);
    expect(validateBalancesSumZero(balances2)).toBe(true);
  });

  test("solde nul quand pas de dépenses", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    
    const balances = computeBalances(state);
    expect(balances[0].balance).toBe(0);
    expect(balances[1].balance).toBe(0);
    expect(validateBalancesSumZero(balances)).toBe(true);
  });

  test("montant négatif n'est pas autorisé (rejeté à l'ajout)", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    const aliceId = state.participants[0].id;
    state = addExpense(state, "Test", -100, aliceId, []);
    expect(state.expenses).toHaveLength(0);
    
    const balances = computeBalances(state);
    expect(balances[0].balance).toBe(0);
  });

  test("somme des soldes toujours zéro", () => {
    let state = createTestState();
    state = addParticipant(state, "Alice");
    state = addParticipant(state, "Bob");
    state = addParticipant(state, "Charlie");
    state = addParticipant(state, "David");
    const aliceId = state.participants[0].id;
    const bobId = state.participants[1].id;
    
    // Dépenses variées
    state = addExpense(state, "Repas", 12345, aliceId, []); // 123,45€ pour tous
    state = addExpense(state, "Taxi", 5678, bobId, [aliceId, bobId]); // 56,78€ pour Alice et Bob
    state = addExpense(state, "Musée", 1000, aliceId, [bobId]); // 10€ pour Bob seulement
    
    const balances = computeBalances(state);
    expect(validateBalancesSumZero(balances)).toBe(true);
    
    // Vérifier que les montants sont cohérents
    const totalPaid = balances.reduce((sum, b) => sum + b.paid, 0);
    const totalShare = balances.reduce((sum, b) => sum + b.share, 0);
    expect(totalPaid).toBe(totalShare);
  });
});

describe("computeTransfers - remboursements minimaux", () => {
  test("cas simple : Alice a payé pour Bob, Bob doit rembourser Alice", () => {
    const balances = [
      { participantId: "1", participantName: "Alice", paid: 3000, share: 1000, balance: 2000 },
      { participantId: "2", participantName: "Bob", paid: 0, share: 1000, balance: -1000 },
      { participantId: "3", participantName: "Charlie", paid: 0, share: 1000, balance: -1000 },
    ];
    
    const transfers = computeTransfers(balances);
    // Bob paie 10€ à Alice, Charlie paie 10€ à Alice = 2 transferts
    expect(transfers).toHaveLength(2);
    expect(transfers[0].fromName).toBe("Bob");
    expect(transfers[0].toName).toBe("Alice");
    expect(transfers[0].amount).toBe(1000);
    expect(transfers[1].fromName).toBe("Charlie");
    expect(transfers[1].toName).toBe("Alice");
    expect(transfers[1].amount).toBe(1000);
  });

  test("chaînage : Alice doit à Bob, Bob doit à Charlie -> Alice paie Charlie directement", () => {
    const balances = [
      { participantId: "1", participantName: "Alice", paid: 0, share: 1000, balance: -1000 },
      { participantId: "2", participantName: "Bob", paid: 1000, share: 1000, balance: 0 },
      { participantId: "3", participantName: "Charlie", paid: 2000, share: 1000, balance: 1000 },
    ];
    
    const transfers = computeTransfers(balances);
    // Alice (-1000) paie Charlie (+1000) directement = 1 seul transfert
    expect(transfers).toHaveLength(1);
    expect(transfers[0].fromName).toBe("Alice");
    expect(transfers[0].toName).toBe("Charlie");
    expect(transfers[0].amount).toBe(1000);
  });

  test("cas complexe : minimise le nombre de virements", () => {
    const balances = [
      { participantId: "1", participantName: "Alice", paid: 5000, share: 1000, balance: 4000 },
      { participantId: "2", participantName: "Bob", paid: 3000, share: 2000, balance: 1000 },
      { participantId: "3", participantName: "Charlie", paid: 0, share: 3000, balance: -3000 },
      { participantId: "4", participantName: "David", paid: 0, share: 2000, balance: -2000 },
    ];
    
    const transfers = computeTransfers(balances);
    // Charlie (-3000) paie Alice (+4000) -> 3000
    // David (-2000) paie Alice (+1000 restant) -> 1000
    // David paie Bob (+1000) -> 1000
    // Total 3 transferts (optimal pour 4 personnes avec 2 créanciers et 2 débiteurs)
    expect(transfers.length).toBeLessThanOrEqual(3);
    
    // Vérifier que les montants sont corrects
    const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0);
    const totalPositive = balances.filter(b => b.balance > 0).reduce((sum, b) => sum + b.balance, 0);
    expect(totalTransferred).toBe(totalPositive);
  });

  test("aucun transfert si tout est équilibré", () => {
    const balances = [
      { participantId: "1", participantName: "Alice", paid: 1000, share: 1000, balance: 0 },
      { participantId: "2", participantName: "Bob", paid: 1000, share: 1000, balance: 0 },
    ];
    
    const transfers = computeTransfers(balances);
    expect(transfers).toHaveLength(0);
  });
});

describe("formatCents / parseCents", () => {
  test("formatCents affiche correctement", () => {
    expect(formatCents(1234)).toBe("12,34 €");
    expect(formatCents(100)).toBe("1,00 €");
    expect(formatCents(0)).toBe("0,00 €");
    expect(formatCents(-500)).toBe("-5,00 €");
  });

  test("parseCents parse correctement", () => {
    expect(parseCents("12,34")).toBe(1234);
    expect(parseCents("12.34")).toBe(1234);
    expect(parseCents("12,34 €")).toBe(1234);
    expect(parseCents("  1 234,56  ")).toBe(123456);
    expect(parseCents("invalid")).toBe(0);
  });

  test("round-trip formatCents -> parseCents", () => {
    const values = [0, 1, 100, 1234, 10000, 123456, -500];
    for (const v of values) {
      expect(parseCents(formatCents(v))).toBe(v);
    }
  });
});