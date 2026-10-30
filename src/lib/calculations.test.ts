import { describe, it, expect } from 'vitest';
import {
  calculateBalances,
  calculateTransfers,
  isDuplicateName,
  parseCents,
  formatCents,
  generateId,
} from './calculations';
import { Participant, Expense } from './calculations';

describe('calculations', () => {
  const createParticipant = (name: string): Participant => ({
    id: `id-${name}`,
    name,
  });

  const createExpense = (overrides: Partial<Expense> = {}): Expense => ({
    id: generateId(),
    label: 'Test',
    amount: 1000, // 10.00 €
    paidBy: 'id-Alice',
    forWhom: [],
    date: '2026-10-30',
    ...overrides,
  });

  describe('calculateBalances', () => {
    it('should return zero balances for empty expenses', () => {
      const participants = [createParticipant('Alice'), createParticipant('Bob')];
      const expenses: Expense[] = [];

      const balances = calculateBalances(participants, expenses);

      expect(balances).toHaveLength(2);
      balances.forEach((b) => {
        expect(b.paid).toBe(0);
        expect(b.share).toBe(0);
        expect(b.balance).toBe(0);
      });
    });

    it('should calculate equal split for two people', () => {
      const participants = [
        createParticipant('Alice'),
        createParticipant('Bob'),
      ];
      const expenses = [
        createExpense({
          amount: 1000, // 10.00 €
          paidBy: 'id-Alice',
          forWhom: ['id-Alice', 'id-Bob'],
        }),
      ];

      const balances = calculateBalances(participants, expenses);

      // Alice paid 10€, share is 5€ each → balance +5€
      const alice = balances.find((b) => b.participantName === 'Alice')!;
      expect(alice.paid).toBe(1000);
      expect(alice.share).toBe(500);
      expect(alice.balance).toBe(500);

      // Bob paid 0, share is 5€ → balance -5€
      const bob = balances.find((b) => b.participantName === 'Bob')!;
      expect(bob.paid).toBe(0);
      expect(bob.share).toBe(500);
      expect(bob.balance).toBe(-500);

      // Sum of balances = 0
      const total = balances.reduce((sum, b) => sum + b.balance, 0);
      expect(total).toBe(0);
    });

    it('should handle three people with equal split', () => {
      const participants = [
        createParticipant('Alice'),
        createParticipant('Bob'),
        createParticipant('Charlie'),
      ];
      const expenses = [
        createExpense({
          amount: 3000, // 30.00 €
          paidBy: 'id-Alice',
          forWhom: ['id-Alice', 'id-Bob', 'id-Charlie'],
        }),
      ];

      const balances = calculateBalances(participants, expenses);

      const alice = balances.find((b) => b.participantName === 'Alice')!;
      expect(alice.balance).toBe(2000); // 30 - 10 = 20

      const bob = balances.find((b) => b.participantName === 'Bob')!;
      expect(bob.balance).toBe(-1000);

      const charlie = balances.find((b) => b.participantName === 'Charlie')!;
      expect(charlie.balance).toBe(-1000);

      const total = balances.reduce((sum, b) => sum + b.balance, 0);
      expect(total).toBe(0);
    });

    it('should handle remainder centimes correctly (100 split by 3 = 33, 33, 34)', () => {
      const participants = [
        createParticipant('Alice'),
        createParticipant('Bob'),
        createParticipant('Charlie'),
      ];
      const expenses = [
        createExpense({
          amount: 100, // 1.00 €
          paidBy: 'id-Alice',
          forWhom: ['id-Alice', 'id-Bob', 'id-Charlie'],
        }),
      ];

      const balances = calculateBalances(participants, expenses);

      // 100 centimes / 3 = 33 with remainder 1
      // First person gets extra centime
      const alice = balances.find((b) => b.participantName === 'Alice')!;
      expect(alice.share).toBe(34); // First gets the remainder
      expect(alice.balance).toBe(66); // 100 - 34

      const bob = balances.find((b) => b.participantName === 'Bob')!;
      expect(bob.share).toBe(33);
      expect(bob.balance).toBe(-33);

      const charlie = balances.find((b) => b.participantName === 'Charlie')!;
      expect(charlie.share).toBe(33);
      expect(charlie.balance).toBe(-33);

      const total = balances.reduce((sum, b) => sum + b.balance, 0);
      expect(total).toBe(0);
    });

    it('should handle multiple expenses', () => {
      const participants = [
        createParticipant('Alice'),
        createParticipant('Bob'),
      ];
      const expenses = [
        createExpense({ amount: 1000, paidBy: 'id-Alice' }), // Alice pays 10€ for both
        createExpense({ amount: 2000, paidBy: 'id-Bob' }), // Bob pays 20€ for both
      ];

      const balances = calculateBalances(participants, expenses);

      // Alice: paid 10, share 15 (5+10) → balance -5
      const alice = balances.find((b) => b.participantName === 'Alice')!;
      expect(alice.paid).toBe(1000);
      expect(alice.share).toBe(1500);
      expect(alice.balance).toBe(-500);

      // Bob: paid 20, share 15 → balance +5
      const bob = balances.find((b) => b.participantName === 'Bob')!;
      expect(bob.paid).toBe(2000);
      expect(bob.share).toBe(1500);
      expect(bob.balance).toBe(500);

      const total = balances.reduce((sum, b) => sum + b.balance, 0);
      expect(total).toBe(0);
    });

    it('should handle partial participants (forWhom subset)', () => {
      const participants = [
        createParticipant('Alice'),
        createParticipant('Bob'),
        createParticipant('Charlie'),
      ];
      const expenses = [
        createExpense({
          amount: 3000,
          paidBy: 'id-Alice',
          forWhom: ['id-Alice', 'id-Bob'], // Charlie not included
        }),
      ];

      const balances = calculateBalances(participants, expenses);

      const alice = balances.find((b) => b.participantName === 'Alice')!;
      expect(alice.share).toBe(1500); // 3000 / 2
      expect(alice.balance).toBe(1500); // 3000 - 1500

      const bob = balances.find((b) => b.participantName === 'Bob')!;
      expect(bob.share).toBe(1500);
      expect(bob.balance).toBe(-1500);

      const charlie = balances.find((b) => b.participantName === 'Charlie')!;
      expect(charlie.share).toBe(0);
      expect(charlie.balance).toBe(0);

      const total = balances.reduce((sum, b) => sum + b.balance, 0);
      expect(total).toBe(0);
    });

    it('should handle empty forWhom (defaults to all)', () => {
      const participants = [
        createParticipant('Alice'),
        createParticipant('Bob'),
      ];
      const expenses = [
        createExpense({
          amount: 1000,
          paidBy: 'id-Alice',
          forWhom: [], // empty = everyone
        }),
      ];

      const balances = calculateBalances(participants, expenses);

      const alice = balances.find((b) => b.participantName === 'Alice')!;
      expect(alice.share).toBe(500);
      expect(alice.balance).toBe(500);

      const bob = balances.find((b) => b.participantName === 'Bob')!;
      expect(bob.share).toBe(500);
      expect(bob.balance).toBe(-500);

      const total = balances.reduce((sum, b) => sum + b.balance, 0);
      expect(total).toBe(0);
    });
  });

  describe('calculateTransfers', () => {
    it('should return empty transfers when all balanced', () => {
      const balances = [
        { participantId: '1', participantName: 'Alice', paid: 1000, share: 1000, balance: 0 },
        { participantId: '2', participantName: 'Bob', paid: 1000, share: 1000, balance: 0 },
      ];

      const transfers = calculateTransfers(balances);
      expect(transfers).toHaveLength(0);
    });

    it('should create one transfer for two people', () => {
      const balances = [
        { participantId: '1', participantName: 'Alice', paid: 2000, share: 1000, balance: 1000 },
        { participantId: '2', participantName: 'Bob', paid: 0, share: 1000, balance: -1000 },
      ];

      const transfers = calculateTransfers(balances);

      expect(transfers).toHaveLength(1);
      expect(transfers[0].from).toBe('2'); // Bob pays
      expect(transfers[0].to).toBe('1'); // Alice receives
      expect(transfers[0].amount).toBe(1000);
    });

    it('should minimize number of transfers with three people', () => {
      const balances = [
        { participantId: '1', participantName: 'Alice', paid: 3000, share: 1000, balance: 2000 },
        { participantId: '2', participantName: 'Bob', paid: 0, share: 1000, balance: -1000 },
        { participantId: '3', participantName: 'Charlie', paid: 0, share: 1000, balance: -1000 },
      ];

      const transfers = calculateTransfers(balances);

      // Should be 2 transfers (Bob→Alice 1000, Charlie→Alice 1000)
      expect(transfers).toHaveLength(2);
      const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);
      expect(totalAmount).toBe(2000);
    });

    it('should handle multiple creditors and debtors', () => {
      const balances = [
        { participantId: '1', participantName: 'Alice', paid: 5000, share: 1000, balance: 4000 },
        { participantId: '2', participantName: 'Bob', paid: 3000, share: 1000, balance: 2000 },
        { participantId: '3', participantName: 'Charlie', paid: 0, share: 1000, balance: -1000 },
        { participantId: '4', participantName: 'David', paid: 0, share: 1000, balance: -1000 },
        { participantId: '5', participantName: 'Eve', paid: 0, share: 1000, balance: -1000 },
        { participantId: '6', participantName: 'Frank', paid: 0, share: 1000, balance: -1000 },
        // Add more debtors to balance: need 2000 more in negative balances
        { participantId: '7', participantName: 'Grace', paid: 0, share: 1000, balance: -1000 },
        { participantId: '8', participantName: 'Henry', paid: 0, share: 1000, balance: -1000 },
      ];

      const transfers = calculateTransfers(balances);

      expect(transfers.length).toBeLessThanOrEqual(7); // At most n-1 transfers
      const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0);
      expect(totalAmount).toBe(6000); // Sum of positive balances
    });

    it('should handle zero and negative amounts correctly', () => {
      const balances = [
        { participantId: '1', participantName: 'Alice', paid: 0, share: 0, balance: 0 },
        { participantId: '2', participantName: 'Bob', paid: 0, share: 0, balance: 0 },
      ];

      const transfers = calculateTransfers(balances);
      expect(transfers).toHaveLength(0);
    });
  });

  describe('isDuplicateName', () => {
    it('should detect exact duplicates', () => {
      const participants = [createParticipant('Alice'), createParticipant('Bob')];
      expect(isDuplicateName(participants, 'Alice')).toBe(true);
      expect(isDuplicateName(participants, 'Charlie')).toBe(false);
    });

    it('should be case insensitive', () => {
      const participants = [createParticipant('Alice')];
      expect(isDuplicateName(participants, 'alice')).toBe(true);
      expect(isDuplicateName(participants, 'ALICE')).toBe(true);
    });

    it('should trim whitespace', () => {
      const participants = [createParticipant('Alice')];
      expect(isDuplicateName(participants, ' Alice ')).toBe(true);
    });

    it('should handle empty string', () => {
      const participants = [createParticipant('Alice')];
      expect(isDuplicateName(participants, '')).toBe(false);
    });
  });

  describe('parseCents', () => {
    it('should parse integer euros', () => {
      expect(parseCents('10')).toBe(1000);
      expect(parseCents('0')).toBe(0);
    });

    it('should parse with comma decimal', () => {
      expect(parseCents('10,50')).toBe(1050);
      expect(parseCents('10,5')).toBe(1050);
      expect(parseCents('0,01')).toBe(1);
    });

    it('should parse with dot decimal', () => {
      expect(parseCents('10.50')).toBe(1050);
      expect(parseCents('10.5')).toBe(1050);
    });

    it('should handle space as thousands separator (French format)', () => {
      expect(parseCents('1 000')).toBe(100000);
      expect(parseCents('1 000,50')).toBe(100050);
    });

    it('should handle euro symbol', () => {
      expect(parseCents('10,50 €')).toBe(1050);
      expect(parseCents('€10,50')).toBe(1050);
    });

    it('should return 0 for invalid input', () => {
      expect(parseCents('abc')).toBe(0);
      expect(parseCents('')).toBe(0);
    });
  });

  describe('formatCents', () => {
    it('should format positive amounts', () => {
      expect(formatCents(1000)).toBe('10,00\u00A0€');
      expect(formatCents(1050)).toBe('10,50\u00A0€');
      expect(formatCents(1)).toBe('0,01\u00A0€');
    });

    it('should format zero', () => {
      expect(formatCents(0)).toBe('0,00\u00A0€');
    });

    it('should format negative amounts', () => {
      expect(formatCents(-1000)).toBe('-10,00\u00A0€');
      expect(formatCents(-1050)).toBe('-10,50\u00A0€');
    });

    it('should format large amounts with spaces', () => {
      // Intl.NumberFormat('fr-FR') uses narrow non-breaking space (U+202F) for thousands
      expect(formatCents(100000)).toBe('1\u202F000,00\u00A0€');
      // 1234567 cents = 12345.67 €
      expect(formatCents(1234567)).toBe('12\u202F345,67\u00A0€');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should generate string IDs', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });
});