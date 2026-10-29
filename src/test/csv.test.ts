import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAmount } from '../kit/format';
import { importCsv, parse } from '../kit/csv';
import { useEntries, STORE_KEY } from '../kit/store';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock toast
vi.mock('../kit/toast', () => ({
  toast: vi.fn(),
}));

describe('parseAmount', () => {
  it('parses standard French amounts with comma decimal', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('-12,50')).toBe(-12.5);
  });

  it('parses amounts with space thousands separator', () => {
    expect(parseAmount('1 250,00')).toBe(1250);
    expect(parseAmount('-1 250,00')).toBe(-1250);
    expect(parseAmount('12 345 678,90')).toBe(12345678.9);
  });

  it('parses amounts with non-breaking space (U+00A0)', () => {
    expect(parseAmount('1\u00A0250,00')).toBe(1250);
    expect(parseAmount('-1\u00A0250,00')).toBe(-1250);
  });

  it('parses amounts with narrow non-breaking space (U+202F)', () => {
    expect(parseAmount('1\u202F250,00')).toBe(1250);
    expect(parseAmount('-1\u202F250,00')).toBe(-1250);
  });

  it('parses integer amounts', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount('-50')).toBe(-50);
  });

  it('handles decimal point format', () => {
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('returns NaN for invalid input', () => {
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
  });
});

describe('CSV parsing (parse function)', () => {
  it('parses semicolon-separated CSV', () => {
    const csv = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50
02/01/2026;SNCF;-25,00`;
    const rows = parse(csv);
    expect(rows.length).toBe(3); // header + 2 rows
    expect(rows[0]).toEqual(['Date', 'Libellé', 'Montant']);
    expect(rows[1]).toEqual(['01/01/2026', 'CARREFOUR', '-45,50']);
    expect(rows[2]).toEqual(['02/01/2026', 'SNCF', '-25,00']);
  });

  it('handles quoted fields with semicolons', () => {
    const csv = `Date;Libellé;Montant
01/01/2026;"CARREFOUR; SUPERMARCHE";-45,50`;
    const rows = parse(csv);
    expect(rows[1][1]).toBe('CARREFOUR; SUPERMARCHE');
  });

  it('handles empty lines', () => {
    const csv = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50

02/01/2026;SNCF;-25,00`;
    const rows = parse(csv);
    expect(rows.length).toBe(3); // header + 2 rows (empty line skipped)
  });

  it('handles BOM at start', () => {
    const csv = `\uFEFFDate;Libellé;Montant
01/01/2026;CARREFOUR;-45,50`;
    const rows = parse(csv);
    expect(rows[0][0]).toBe('Date');
  });

  it('handles CRLF line endings', () => {
    const csv = `Date;Libellé;Montant\r
01/01/2026;CARREFOUR;-45,50\r
02/01/2026;SNCF;-25,00`;
    const rows = parse(csv);
    expect(rows.length).toBe(3);
  });
});

describe('Bank CSV import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    // Reset store
    useEntries.setState({ entries: [], month: '2026-10', fresh: null });
  });

  afterEach(() => {
    useEntries.setState({ entries: [], month: '2026-10', fresh: null });
  });

  it('imports standard French bank CSV', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50
02/01/2026;SNCF;-25,00
03/01/2026;SALAIRE;2500,00`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    const count = await importCsv(file);

    expect(count).toBe(3);
    const entries = useEntries.getState().entries;
    expect(entries.length).toBe(3);
    
    // Check first entry
    const carrefour = entries.find(e => e.label === 'CARREFOUR');
    expect(carrefour).toBeDefined();
    expect(carrefour?.amount).toBe(-45.5);
    expect(carrefour?.date).toBe('2026-01-01');
    
    // Check income
    const salaire = entries.find(e => e.label === 'SALAIRE');
    expect(salaire?.amount).toBe(2500);
  });

  it('imports CSV with thousands separators', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;GROS ACHAT;-1 250,00
02/01/2026;TRES GROS;-12 345 678,90`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    const count = await importCsv(file);

    expect(count).toBe(2);
    const entries = useEntries.getState().entries;
    const gros = entries.find(e => e.label === 'GROS ACHAT');
    expect(gros?.amount).toBe(-1250);
    const tres = entries.find(e => e.label === 'TRES GROS');
    expect(tres?.amount).toBe(-12345678.9);
  });

  it('imports CSV with non-breaking spaces', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;ACHAT;-1\u00A0250,00
02/01/2026;ACHAT2;-1\u202F250,00`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    const count = await importCsv(file);

    expect(count).toBe(2);
    const entries = useEntries.getState().entries;
    expect(entries[0].amount).toBe(-1250);
    expect(entries[1].amount).toBe(-1250);
  });

  it('converts DD/MM/YYYY dates to YYYY-MM-DD', async () => {
    const csvContent = `Date;Libellé;Montant
31/12/2025;FIN ANNEE;-100,00
01/01/2026;DEBUT ANNEE;-50,00`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    await importCsv(file);

    const entries = useEntries.getState().entries;
    expect(entries[0].date).toBe('2025-12-31');
    expect(entries[1].date).toBe('2026-01-01');
  });

  it('handles CSV with extra columns (ignores them)', async () => {
    const csvContent = `Date;Libellé;Montant;Solde;Info
01/01/2026;CARREFOUR;-45,50;1000,00;CARTE`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    const count = await importCsv(file);

    expect(count).toBe(1);
    const entries = useEntries.getState().entries;
    expect(entries[0].label).toBe('CARREFOUR');
    expect(entries[0].amount).toBe(-45.5);
  });

  it('handles CSV with different column order', async () => {
    const csvContent = `Libellé;Date;Montant
CARREFOUR;01/01/2026;-45,50`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    const count = await importCsv(file);

    expect(count).toBe(1);
    const entries = useEntries.getState().entries;
    expect(entries[0].label).toBe('CARREFOUR');
    expect(entries[0].date).toBe('2026-01-01');
    expect(entries[0].amount).toBe(-45.5);
  });

  it('skips empty or invalid lines', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50
;;;
02/01/2026;SNCF;-25,00
invalide;invalide;invalide`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    const count = await importCsv(file);

    expect(count).toBe(2); // Only valid lines
  });
});

describe('Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    useEntries.setState({ entries: [], month: '2026-10', fresh: null });
  });

  afterEach(() => {
    useEntries.setState({ entries: [], month: '2026-10', fresh: null });
  });

  it('does not duplicate entries with same ID', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50`;

    // First import
    const file1 = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    await importCsv(file1);
    expect(useEntries.getState().entries.length).toBe(1);

    // Second import with same data (should have same ID if we generate from content)
    const file2 = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    await importCsv(file2);
    
    // Should still be 1 (deduplicated by ID)
    expect(useEntries.getState().entries.length).toBe(1);
  });

  it('does not duplicate when importing overlapping statements', async () => {
    // First statement: Jan 1-15
    const csv1 = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50
10/01/2026;SNCF;-25,00`;

    // Second statement: Jan 10-31 (overlaps)
    const csv2 = `Date;Libellé;Montant
10/01/2026;SNCF;-25,00
15/01/2026;EDF;-80,00`;

    const file1 = new File([csv1], 'releve1.csv', { type: 'text/csv' });
    await importCsv(file1);
    expect(useEntries.getState().entries.length).toBe(2);

    const file2 = new File([csv2], 'releve2.csv', { type: 'text/csv' });
    await importCsv(file2);
    
    // Should have 3 unique entries (CARREFOUR, SNCF, EDF)
    expect(useEntries.getState().entries.length).toBe(3);
    
    const labels = useEntries.getState().entries.map(e => e.label).sort();
    expect(labels).toEqual(['CARREFOUR', 'EDF', 'SNCF']);
  });

  it('preserves manually changed categories on re-import', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    await importCsv(file);
    
    // User manually changes category
    const entry = useEntries.getState().entries[0];
    useEntries.getState().update(entry.id, { category: 'Courses' });
    expect(useEntries.getState().entries[0].category).toBe('Courses');

    // Re-import same CSV
    const file2 = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    await importCsv(file2);
    
    // Category should be preserved
    expect(useEntries.getState().entries[0].category).toBe('Courses');
  });

  it('allows undo after import', async () => {
    const csvContent = `Date;Libellé;Montant
01/01/2026;CARREFOUR;-45,50`;

    const file = new File([csvContent], 'releve.csv', { type: 'text/csv' });
    await importCsv(file);
    expect(useEntries.getState().entries.length).toBe(1);

    // Get the toast call to find the undo action
    const { toast } = await import('../kit/toast');
    expect(toast).toHaveBeenCalled();
    const lastCall = vi.mocked(toast).mock.calls[vi.mocked(toast).mock.calls.length - 1];
    const undoAction = lastCall[1]?.action?.run;
    
    if (undoAction) {
      undoAction();
      expect(useEntries.getState().entries.length).toBe(0);
    }
  });
});