// Types pour l'application de partage de dépenses

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
  date: string; // ISO date
};

export type TripData = {
  participants: Participant[];
  expenses: Expense[];
};

export type Balance = {
  participantId: string;
  participantName: string;
  paid: number; // ce qu'il a payé (en centimes)
  share: number; // sa part (en centimes)
  balance: number; // payé - part (positif = on lui doit, négatif = il doit)
};

export type Settlement = {
  from: string; // participant id qui paie
  fromName: string;
  to: string; // participant id qui reçoit
  toName: string;
  amount: number; // en centimes
};

// Pour le formulaire d'ajout de dépense
export type NewExpense = Omit<Expense, "id" | "date"> & { date?: string };

// Pour le formulaire d'ajout de participant
export type NewParticipant = Omit<Participant, "id">;