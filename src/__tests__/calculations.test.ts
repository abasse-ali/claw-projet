import {
  computeBalances,
  computeSettlements,
  validateBalances,
  parseAmountToCents,
  centsToEuros,
  type Participant,
  type Expense,
  type Balance,
  type Settlement,
} from "../store";

describe("parseAmountToCents", () => {
  test("parse un montant avec virgule", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
  });

  test("parse un montant avec point", () => {
    expect(parseAmountToCents("12.50")).toBe(1250);
  });

  test("parse un montant entier", () => {
    expect(parseAmountToCents("100")).toBe(10000);
  });

  test("parse un montant avec symbole euro", () => {
    expect(parseAmountToCents("12,50 €")).toBe(1250);
    expect(parseAmountToCents("12.50€")).toBe(1250);
  });

  test("retourne NaN pour une entrée invalide", () => {
    expect(parseAmountToCents("abc")).toBeNaN();
    expect(parseAmountToCents("")).toBeNaN();
    expect(parseAmountToCents("   ")).toBeNaN();
  });

  test("arrondit au centime près", () => {
    expect(parseAmountToCents("10,005")).toBe(1001); // 10.005 -> 1001 centimes
    expect(parseAmountToCents("10,004")).toBe(1000); // 10.004 -> 1000 centimes
  });
});

describe("centsToEuros", () => {
  test("convertit les centimes en euros", () => {
    expect(centsToEuros(1250)).toBe(12.5);
    expect(centsToEuros(10000)).toBe(100);
    expect(centsToEuros(0)).toBe(0);
    expect(centsToEuros(-500)).toBe(-5);
  });
});

describe("computeBalances - partage au centime près", () => {
  const participants: Participant[] = [
    { id: "1", firstName: "Alice" },
    { id: "2", firstName: "Bob" },
    { id: "3", firstName: "Charlie" },
  ];

  test("trois lignes de 10 centimes = 30 centimes exactement", () => {
    const expenses: Expense[] = [
      { id: "e1", label: "Café", amount: 10, paidBy: "1", sharedWith: ["1", "2", "3"] },
      { id: "e2", label: "Thé", amount: 10, paidBy: "1", sharedWith: ["1", "2", "3"] },
      { id: "e3", label: "Eau", amount: 10, paidBy: "1", sharedWith: ["1", "2", "3"] },
    ];

    const balances = computeBalances(participants, expenses);

    // Chaque dépense de 10 centimes partagée en 3 -> parts: 4, 3, 3 (reste au premier)
    // Sur 3 dépenses: Alice (index 0) = 4*3=12, Bob (index 1) = 3*3=9, Charlie (index 2) = 3*3=9
    // Alice a payé 30, part = 12, balance = +18
    // Bob part = 9, balance = -9
    // Charlie part = 9, balance = -9
    expect(balances.find((b) => b.participantId === "1")?.balance).toBe(18);
    expect(balances.find((b) => b.participantId === "2")?.balance).toBe(-9);
    expect(balances.find((b) => b.participantId === "3")?.balance).toBe(-9);

    // Somme des soldes = 0
    expect(validateBalances(balances)).toBe(true);
    // Somme des parts = montant total
    const totalShares = balances.reduce((sum, b) => sum + b.share, 0);
    expect(totalShares).toBe(30);
  });

  test("100 centimes partagés en 3 = 33 + 33 + 34", () => {
    const expenses: Expense[] = [
      { id: "e1", label: "Repas", amount: 100, paidBy: "1", sharedWith: ["1", "2", "3"] },
    ];

    const balances = computeBalances(participants, expenses);

    // Alice a payé 100, parts : 33, 33, 34 (total 100)
    const alice = balances.find((b) => b.participantId === "1")!;
    const bob = balances.find((b) => b.participantId === "2")!;
    const charlie = balances.find((b) => b.participantId === "3")!;

    // Vérifier que la somme des parts = 100
    expect(alice.share + bob.share + charlie.share).toBe(100);
    // Alice a payé 100
    expect(alice.paid).toBe(100);
    // Bob et Charlie n'ont rien payé
    expect(bob.paid).toBe(0);
    expect(charlie.paid).toBe(0);

    // Vérifier les soldes
    expect(alice.balance + bob.balance + charlie.balance).toBe(0);
    expect(validateBalances(balances)).toBe(true);
  });

  test("2.665 euros = 266.5 centimes -> arrondi 267 centimes partagé", () => {
    // Test avec un montant qui crée des restes
    const expenses: Expense[] = [
      { id: "e1", label: "Test", amount: 267, paidBy: "1", sharedWith: ["1", "2"] },
    ];

    const balances = computeBalances(participants.slice(0, 2), expenses);

    // 267 / 2 = 133.5 -> 133 et 134
    const shares = [balances[0].share, balances[1].share].sort((a, b) => a - b);
    expect(shares).toEqual([133, 134]);
    expect(balances[0].share + balances[1].share).toBe(267);
    expect(validateBalances(balances)).toBe(true);
  });

  test("montant zéro", () => {
    const expenses: Expense[] = [
      { id: "e1", label: "Gratuit", amount: 0, paidBy: "1", sharedWith: ["1", "2", "3"] },
    ];

    const balances = computeBalances(participants, expenses);
    expect(balances.every((b) => b.balance === 0)).toBe(true);
    expect(validateBalances(balances)).toBe(true);
  });

  test("montant négatif (remboursement)", () => {
    const expenses: Expense[] = [
      { id: "e1", label: "Remboursement", amount: -500, paidBy: "1", sharedWith: ["1", "2"] },
    ];

    const balances = computeBalances(participants.slice(0, 2), expenses);
    // Montant négatif : le payeur "reçoit" de l'argent
    // En réalité, une dépense négative n'a pas de sens métier, mais l'algo doit tenir
    expect(validateBalances(balances)).toBe(true);
  });

  test("bénéficiaires spécifiques (pas tout le monde)", () => {
    const expenses: Expense[] = [
      { id: "e1", label: "Dîner", amount: 6000, paidBy: "1", sharedWith: ["1", "2"] }, // Alice et Bob seulement
    ];

    const balances = computeBalances(participants, expenses);

    const alice = balances.find((b) => b.participantId === "1")!;
    const bob = balances.find((b) => b.participantId === "2")!;
    const charlie = balances.find((b) => b.participantId === "3")!;

    // Alice a payé 6000, partagée avec Bob (2 personnes) -> 3000 chacun
    expect(alice.paid).toBe(6000);
    expect(alice.share).toBe(3000);
    expect(bob.share).toBe(3000);
    expect(charlie.share).toBe(0); // Charlie n'est pas concerné

    expect(alice.balance).toBe(3000); // 6000 - 3000
    expect(bob.balance).toBe(-3000); // 0 - 3000
    expect(charlie.balance).toBe(0);

    expect(validateBalances(balances)).toBe(true);
  });

  test("plusieurs dépenses, plusieurs payeurs", () => {
    const expenses: Expense[] = [
      { id: "e1", label: "Courses", amount: 3000, paidBy: "1", sharedWith: ["1", "2", "3"] },
      { id: "e2", label: "Essence", amount: 5000, paidBy: "2", sharedWith: ["1", "2", "3"] },
      { id: "e3", label: "Hôtel", amount: 9000, paidBy: "3", sharedWith: ["1", "2"] }, // Charlie pas concerné
    ];

    const balances = computeBalances(participants, expenses);

    // Alice : payé 3000, parts: 1000 + 1666 + 4500 = 7166, balance = 3000 - 7166 = -4166
    // Bob : payé 5000, parts: 1000 + 1667 + 4500 = 7167, balance = 5000 - 7167 = -2167
    // Charlie : payé 9000, parts: 1000 + 1667 + 0 = 2667, balance = 9000 - 2667 = +6333
    // Somme: -4166 + -2167 + 6333 = 0 ✓

    expect(validateBalances(balances)).toBe(true);

    const alice = balances.find((b) => b.participantId === "1")!;
    const bob = balances.find((b) => b.participantId === "2")!;
    const charlie = balances.find((b) => b.participantId === "3")!;

    expect(alice.paid).toBe(3000);
    expect(bob.paid).toBe(5000);
    expect(charlie.paid).toBe(9000);
  });
});

describe("computeSettlements - minimiser les virements", () => {
  const balances: Balance[] = [
    { participantId: "1", paid: 10000, share: 5000, balance: 5000 }, // Alice +50€
    { participantId: "2", paid: 0, share: 3000, balance: -3000 }, // Bob -30€
    { participantId: "3", paid: 0, share: 2000, balance: -2000 }, // Charlie -20€
  ];

  test("calcule les remboursements optimaux", () => {
    const settlements = computeSettlements(balances);

    // Bob (-3000) paie Alice (+5000) -> 3000
    // Charlie (-2000) paie Alice (+2000 restant) -> 2000
    // Total 2 virements (optimal)

    expect(settlements.length).toBe(2);

    const s1 = settlements.find((s) => s.from === "2" && s.to === "1");
    const s2 = settlements.find((s) => s.from === "3" && s.to === "1");

    expect(s1?.amount).toBe(3000);
    expect(s2?.amount).toBe(2000);
  });

  test("équilibre parfait : pas de virement nécessaire", () => {
    const balanced: Balance[] = [
      { participantId: "1", paid: 1000, share: 1000, balance: 0 },
      { participantId: "2", paid: 1000, share: 1000, balance: 0 },
    ];

    const settlements = computeSettlements(balanced);
    expect(settlements.length).toBe(0);
  });

  test("un débiteur, un créancier", () => {
    const simple: Balance[] = [
      { participantId: "1", paid: 5000, share: 0, balance: 5000 },
      { participantId: "2", paid: 0, share: 5000, balance: -5000 },
    ];

    const settlements = computeSettlements(simple);
    expect(settlements.length).toBe(1);
    expect(settlements[0].from).toBe("2");
    expect(settlements[0].to).toBe("1");
    expect(settlements[0].amount).toBe(5000);
  });

  test("plusieurs débiteurs et créanciers", () => {
    const complex: Balance[] = [
      { participantId: "1", paid: 8000, share: 2000, balance: 6000 }, // +60
      { participantId: "2", paid: 6000, share: 2000, balance: 4000 }, // +40
      { participantId: "3", paid: 0, share: 5000, balance: -5000 }, // -50
      { participantId: "4", paid: 0, share: 5000, balance: -5000 }, // -50
    ];

    const settlements = computeSettlements(complex);

    // Deux créanciers (+60, +40), deux débiteurs (-50, -50)
    // Optimal: 
    // -50 (3) -> +60 (1) : 50, reste +10
    // -50 (4) -> +10 (1) : 10, puis -> +40 (2) : 40
    // Total 3 virements

    expect(settlements.length).toBe(3);
    const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalAmount).toBe(10000); // Somme des montants = total des dettes
  });

  test("les virements équilibrent bien les soldes", () => {
    const settlements = computeSettlements(balances);

    // Appliquer les virements aux soldes
    const finalBalances = new Map(balances.map((b) => [b.participantId, b.balance]));

    for (const s of settlements) {
      finalBalances.set(s.from, (finalBalances.get(s.from) || 0) + s.amount); // débiteur paie -> son solde augmente
      finalBalances.set(s.to, (finalBalances.get(s.to) || 0) - s.amount); // créancier reçoit -> son solde diminue
    }

    // Tous les soldes finaux doivent être 0
    for (const balance of finalBalances.values()) {
      expect(balance).toBe(0);
    }
  });
});

describe("validateBalances", () => {
  test("retourne true si la somme est 0", () => {
    const balances: Balance[] = [
      { participantId: "1", paid: 100, share: 50, balance: 50 },
      { participantId: "2", paid: 0, share: 50, balance: -50 },
    ];
    expect(validateBalances(balances)).toBe(true);
  });

  test("retourne false si la somme n'est pas 0", () => {
    const balances: Balance[] = [
      { participantId: "1", paid: 100, share: 50, balance: 50 },
      { participantId: "2", paid: 0, share: 40, balance: -40 },
    ];
    expect(validateBalances(balances)).toBe(false);
  });

  test("gère un tableau vide", () => {
    expect(validateBalances([])).toBe(true);
  });
});