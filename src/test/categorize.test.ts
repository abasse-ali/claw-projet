import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeEntry, categorizeEntries, CATEGORY_RULES, type CategoryRule } from '../kit/categorize';
import { useEntries } from '../kit/store';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Category rules', () => {
  it('has rules for common French merchants', () => {
    const labels = CATEGORY_RULES.map(r => r.keywords).flat();
    expect(labels).toContain('CARREFOUR');
    expect(labels).toContain('SNCF');
    expect(labels).toContain('EDF');
    expect(labels).toContain('AMAZON');
    expect(labels).toContain('UBER');
  });

  it('each rule has a category and keywords', () => {
    for (const rule of CATEGORY_RULES) {
      expect(rule.category).toBeTruthy();
      expect(rule.keywords).toBeInstanceOf(Array);
      expect(rule.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe('categorizeEntry', () => {
  it('categorizes CARREFOUR as Courses', () => {
    expect(categorizeEntry({ label: 'CARREFOUR', amount: -50 })).toBe('Courses');
    expect(categorizeEntry({ label: 'CARREFOUR MARKET', amount: -30 })).toBe('Courses');
    expect(categorizeEntry({ label: 'CARREFOUR CITY', amount: -20 })).toBe('Courses');
  });

  it('categorizes SNCF as Transport', () => {
    expect(categorizeEntry({ label: 'SNCF', amount: -50 })).toBe('Transport');
    expect(categorizeEntry({ label: 'SNCF TER', amount: -30 })).toBe('Transport');
    expect(categorizeEntry({ label: 'SNCF INTERCITES', amount: -100 })).toBe('Transport');
  });

  it('categorizes EDF as Factures', () => {
    expect(categorizeEntry({ label: 'EDF', amount: -80 })).toBe('Factures');
    expect(categorizeEntry({ label: 'EDF ENERGIE', amount: -120 })).toBe('Factures');
  });

  it('categorizes AMAZON as Shopping', () => {
    expect(categorizeEntry({ label: 'AMAZON', amount: -45 })).toBe('Shopping');
    expect(categorizeEntry({ label: 'AMAZON PRIME', amount: -5 })).toBe('Shopping');
    expect(categorizeEntry({ label: 'AMZN FR', amount: -30 })).toBe('Shopping');
  });

  it('categorizes UBER as Transport', () => {
    expect(categorizeEntry({ label: 'UBER', amount: -15 })).toBe('Transport');
    expect(categorizeEntry({ label: 'UBER *TRIP', amount: -25 })).toBe('Transport');
  });

  it('categorizes LECLERC as Courses', () => {
    expect(categorizeEntry({ label: 'LECLERC', amount: -60 })).toBe('Courses');
    expect(categorizeEntry({ label: 'E.LECLERC', amount: -40 })).toBe('Courses');
  });

  it('categorizes PHARMACIE as Santé', () => {
    expect(categorizeEntry({ label: 'PHARMACIE', amount: -25 })).toBe('Santé');
    expect(categorizeEntry({ label: 'PHARMACIE CENTRALE', amount: -15 })).toBe('Santé');
  });

  it('categorizes RESTAURANT as Sorties', () => {
    expect(categorizeEntry({ label: 'RESTAURANT', amount: -45 })).toBe('Sorties');
    expect(categorizeEntry({ label: 'MC DONALDS', amount: -15 })).toBe('Sorties');
    expect(categorizeEntry({ label: 'KFC', amount: -20 })).toBe('Sorties');
  });

  it('categorizes SALAIRE as Revenus', () => {
    expect(categorizeEntry({ label: 'SALAIRE', amount: 2500 })).toBe('Revenus');
    expect(categorizeEntry({ label: 'VIREMENT SALAIRE', amount: 3000 })).toBe('Revenus');
  });

  it('categorizes VIREMENT as Revenus when positive', () => {
    expect(categorizeEntry({ label: 'VIREMENT', amount: 500 })).toBe('Revenus');
  });

  it('categorizes VIREMENT as Transferts when negative', () => {
    expect(categorizeEntry({ label: 'VIREMENT', amount: -500 })).toBe('Transferts');
  });

  it('returns Autre for unknown labels', () => {
    expect(categorizeEntry({ label: 'MACHIN TRUC', amount: -50 })).toBe('Autre');
    expect(categorizeEntry({ label: '', amount: -50 })).toBe('Autre');
  });

  it('is case insensitive', () => {
    expect(categorizeEntry({ label: 'carrefour', amount: -50 })).toBe('Courses');
    expect(categorizeEntry({ label: 'Carrefour', amount: -50 })).toBe('Courses');
    expect(categorizeEntry({ label: 'SnCf', amount: -50 })).toBe('Transport');
  });

  it('matches partial keywords', () => {
    expect(categorizeEntry({ label: 'PAIEMENT CARREFOUR 1234', amount: -50 })).toBe('Courses');
    expect(categorizeEntry({ label: 'SNCF BILLET 12345', amount: -50 })).toBe('Transport');
  });
});

describe('categorizeEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    useEntries.setState({ entries: [], month: '2026-10', fresh: null });
  });

  afterEach(() => {
    useEntries.setState({ entries: [], month: '2026-10', fresh: null });
  });

  it('categorizes multiple entries at once', () => {
    const entries = [
      { label: 'CARREFOUR', amount: -50, date: '2026-01-01', id: '1', category: '' },
      { label: 'SNCF', amount: -30, date: '2026-01-01', id: '2', category: '' },
      { label: 'SALAIRE', amount: 2500, date: '2026-01-01', id: '3', category: '' },
    ];
    const categorized = categorizeEntries(entries);
    expect(categorized[0].category).toBe('Courses');
    expect(categorized[1].category).toBe('Transport');
    expect(categorized[2].category).toBe('Revenus');
  });

  it('preserves existing categories', () => {
    const entries = [
      { label: 'CARREFOUR', amount: -50, date: '2026-01-01', id: '1', category: 'Alimentation' },
      { label: 'SNCF', amount: -30, date: '2026-01-01', id: '2', category: '' },
    ];
    const categorized = categorizeEntries(entries);
    expect(categorized[0].category).toBe('Alimentation'); // Preserved
    expect(categorized[1].category).toBe('Transport'); // Auto-categorized
  });

  it('returns new array, does not mutate original', () => {
    const entries = [
      { label: 'CARREFOUR', amount: -50, date: '2026-01-01', id: '1', category: '' },
    ];
    const categorized = categorizeEntries(entries);
    expect(categorized).not.toBe(entries);
    expect(entries[0].category).toBe('');
    expect(categorized[0].category).toBe('Courses');
  });
});