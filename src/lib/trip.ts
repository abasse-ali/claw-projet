// Logique métier pour le partage de dépenses de voyage
// Utilise des entiers (centimes) pour éviter les erreurs de précision

export type Participant = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  label: string;
  amount: number; // en centimes
  paidBy: string; // participant id
  splitBetween: string[]; // participant ids, empty = everyone
  date: string; // ISO date
};

export type TripState = {
  participants: Participant[];
  expenses: Expense[];
};

export type Balance = {
  participantId: string;
  participantName: string;
  paid: number; // total paid in cents
  share: number; // total share in cents
  balance: number; // paid - share, positive = should receive, negative = should pay
};

export type Transfer = {
  from: string; // participant id who pays
  fromName: string;
  to: string; // participant id who receives
  toName: string;
  amount: number; // in cents
};

// Générer un ID unique
let idCounter = 0;
const newId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

// Normaliser un nom pour la comparaison (trim + lowercase)
const normalizeName = (name: string) => name.trim().toLowerCase();

// Vérifier si un nom existe déjà (insensible à la casse et espaces)
export function isDuplicateName(participants: Participant[], name: string, excludeId?: string): boolean {
  const normalized = normalizeName(name);
  return participants.some(p => p.id !== excludeId && normalizeName(p.name) === normalized);
}

// Ajouter un participant
export function addParticipant(state: TripState, name: string): TripState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  if (isDuplicateName(state.participants, trimmed)) return state;
  
  return {
    ...state,
    participants: [...state.participants, { id: newId(), name: trimmed }]
  };
}

// Supprimer un participant (seulement s'il n'est dans aucune dépense)
export function removeParticipant(state: TripState, participantId: string): TripState {
  const usedInExpense = state.expenses.some(
    e => e.paidBy === participantId || e.splitBetween.includes(participantId)
  );
  if (usedInExpense) return state;
  
  return {
    ...state,
    participants: state.participants.filter(p => p.id !== participantId)
  };
}

// Ajouter une dépense
export function addExpense(
  state: TripState,
  label: string,
  amount: number, // en centimes
  paidBy: string,
  splitBetween: string[],
  date: string = new Date().toISOString().split('T')[0]
): TripState {
  const trimmed = label.trim();
  if (!trimmed || amount <= 0) return state;
  if (!state.participants.some(p => p.id === paidBy)) return state;
  
  // Si splitBetween est vide, c'est pour tout le monde
  const split = splitBetween.length > 0 ? splitBetween : state.participants.map(p => p.id);
  
  // Vérifier que tous les participants de splitBetween existent
  const validSplit = split.filter(id => state.participants.some(p => p.id === id));
  if (validSplit.length === 0) return state;
  
  return {
    ...state,
    expenses: [...state.expenses, {
      id: newId(),
      label: trimmed,
      amount,
      paidBy,
      splitBetween: validSplit,
      date
    }]
  };
}

// Supprimer une dépense
export function removeExpense(state: TripState, expenseId: string): TripState {
  return {
    ...state,
    expenses: state.expenses.filter(e => e.id !== expenseId)
  };
}

// Calculer les soldes de chaque participant
export function computeBalances(state: TripState): Balance[] {
  const balances = new Map<string, { paid: number; share: number }>();
  
  // Initialiser pour tous les participants
  for (const p of state.participants) {
    balances.set(p.id, { paid: 0, share: 0 });
  }
  
  // Calculer ce que chacun a payé et sa part
  for (const expense of state.expenses) {
    const splitCount = expense.splitBetween.length;
    const sharePerPerson = Math.floor(expense.amount / splitCount);
    const remainder = expense.amount % splitCount;
    
    // Le payeur a payé la totalité
    const paidEntry = balances.get(expense.paidBy);
    if (paidEntry) paidEntry.paid += expense.amount;
    
    // Répartir la part (avec gestion du reste au centime près)
    for (let i = 0; i < expense.splitBetween.length; i++) {
      const participantId = expense.splitBetween[i];
      const entry = balances.get(participantId);
      if (entry) {
        // Les premiers participants prennent le reste (1 centime chacun)
        entry.share += sharePerPerson + (i < remainder ? 1 : 0);
      }
    }
  }
  
  // Construire le résultat
  return state.participants.map(p => {
    const b = balances.get(p.id)!;
    return {
      participantId: p.id,
      participantName: p.name,
      paid: b.paid,
      share: b.share,
      balance: b.paid - b.share
    };
  });
}

// Calculer les remboursements optimaux (algorithme glouton : celui qui doit le plus paye celui à qui on doit le plus)
export function computeTransfers(balances: Balance[]): Transfer[] {
  // Séparer les créanciers (balance > 0) et les débiteurs (balance < 0)
  const creditors = balances
    .filter(b => b.balance > 0)
    .map(b => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining); // Plus gros créancier d'abord
  
  const debtors = balances
    .filter(b => b.balance < 0)
    .map(b => ({ ...b, remaining: -b.balance })) // Valeur positive pour simplifier
    .sort((a, b) => b.remaining - a.remaining); // Plus gros débiteur d'abord
  
  const transfers: Transfer[] = [];
  let cIdx = 0;
  let dIdx = 0;
  
  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];
    
    const amount = Math.min(creditor.remaining, debtor.remaining);
    
    if (amount > 0) {
      transfers.push({
        from: debtor.participantId,
        fromName: debtor.participantName,
        to: creditor.participantId,
        toName: creditor.participantName,
        amount
      });
      
      creditor.remaining -= amount;
      debtor.remaining -= amount;
    }
    
    if (creditor.remaining === 0) cIdx++;
    if (debtor.remaining === 0) dIdx++;
  }
  
  return transfers;
}

// Formater un montant en centimes vers string "12,34 €"
export function formatCents(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace('.', ',');
  return `${euros} €`;
}

// Parser un montant string vers centimes
export function parseCents(input: string): number {
  const cleaned = input.replace(/[€\s]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

// Vérifier que la somme des soldes fait 0
export function validateBalancesSumZero(balances: Balance[]): boolean {
  const sum = balances.reduce((acc, b) => acc + b.balance, 0);
  return sum === 0;
}