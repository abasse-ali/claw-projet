// Modèle de données pour l'application de partage de dépenses de voyage

export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number; // en centimes (entier)
  paidBy: string; // participant id
  sharedWith: string[]; // participant ids, empty = everyone
  date: string; // ISO date "YYYY-MM-DD"
};

export type TravelState = {
  participants: Participant[];
  expenses: Expense[];
  addParticipant: (name: string) => Participant | null;
  removeParticipant: (id: string) => boolean;
  addExpense: (expense: Omit<Expense, "id">) => Expense;
  updateExpense: (id: string, fields: Partial<Omit<Expense, "id">>) => void;
  removeExpense: (id: string) => void;
  clearAll: () => void;
};

// Calculs de soldes et remboursements

export type Balance = {
  participantId: string;
  participantName: string;
  paid: number; // ce qu'il a payé (centimes)
  share: number; // sa part (centimes)
  balance: number; // payé - part (positif = on lui doit, négatif = il doit)
};

export type Settlement = {
  from: string; // participant id qui paie
  fromName: string;
  to: string; // participant id qui reçoit
  toName: string;
  amount: number; // centimes
};

/**
 * Calcule les soldes de chaque participant.
 * La somme des soldes doit toujours faire 0.
 */
export function computeBalances(
  participants: Participant[],
  expenses: Expense[]
): Balance[] {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();

  // Initialiser
  for (const p of participants) {
    paid.set(p.id, 0);
    share.set(p.id, 0);
  }

  // Calculer ce que chacun a payé et sa part
  for (const expense of expenses) {
    const amount = expense.amount;
    const paidBy = expense.paidBy;
    const sharedWith = expense.sharedWith.length > 0 ? expense.sharedWith : participants.map(p => p.id);
    
    // Qui a payé
    paid.set(paidBy, (paid.get(paidBy) || 0) + amount);

    // Part de chacun
    const sharePerPerson = Math.floor(amount / sharedWith.length);
    const remainder = amount % sharedWith.length;
    
    for (let i = 0; i < sharedWith.length; i++) {
      const pid = sharedWith[i];
      const extra = i < remainder ? 1 : 0;
      share.set(pid, (share.get(pid) || 0) + sharePerPerson + extra);
    }
  }

  // Construire les soldes
  const balances: Balance[] = [];
  for (const p of participants) {
    const pPaid = paid.get(p.id) || 0;
    const pShare = share.get(p.id) || 0;
    balances.push({
      participantId: p.id,
      participantName: p.name,
      paid: pPaid,
      share: pShare,
      balance: pPaid - pShare,
    });
  }

  return balances;
}

/**
 * Calcule les remboursements (qui doit combien à qui) avec le minimum de virements.
 * Algorithme glouton : ceux qui doivent paient ceux à qui on doit.
 */
export function computeSettlements(balances: Balance[]): Settlement[] {
  // Copier les soldes pour les modifier
  const creditors = balances
    .filter(b => b.balance > 0)
    .map(b => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining); // Plus gros créanciers d'abord
  
  const debtors = balances
    .filter(b => b.balance < 0)
    .map(b => ({ ...b, remaining: -b.balance })) // Montant positif = ce qu'il doit
    .sort((a, b) => b.remaining - a.remaining); // Plus gros débiteurs d'abord

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const amount = Math.min(creditor.remaining, debtor.remaining);
    
    if (amount > 0) {
      settlements.push({
        from: debtor.participantId,
        fromName: debtor.participantName,
        to: creditor.participantId,
        toName: creditor.participantName,
        amount,
      });
      
      creditor.remaining -= amount;
      debtor.remaining -= amount;
    }

    if (creditor.remaining === 0) creditorIndex++;
    if (debtor.remaining === 0) debtorIndex++;
  }

  return settlements;
}

/**
 * Vérifie que la somme des soldes fait 0 (au centime près).
 */
export function validateBalances(balances: Balance[]): boolean {
  const sum = balances.reduce((acc, b) => acc + b.balance, 0);
  return sum === 0;
}