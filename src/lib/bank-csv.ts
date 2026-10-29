/**
 * Parsing CSV bancaire pour le format français :
 * - Separateur : point-virgule (;)
 * - Date : JJ/MM/AAAA
 * - Montant : virgule pour les decimales, espace pour les milliers, negatif pour les depenses
 * - Colonnes : Date;Libelle;Montant
 */

import { parseAmount, today } from "../kit/format";
import { categorize, DEFAULT_CATEGORIES } from "./categorize";
import { STORE_KEY, useEntries, type Entry, type NewEntry } from "../kit/store";
import { toast } from "../kit/toast";

const cell = (value: unknown) => {
  const text = String(value ?? "");
  return /[\\\";\r\n]/.test(text) ? `"${text.replace(/\"/g, '""')}"` : text;
};

/**
 * Exporte les operations en CSV (format francais).
 */
export function exportCsv(): void {
  const entries = useEntries.getState().entries;
  const lines = entries.map((entry) => [
    entry.date,
    entry.label,
    String(entry.amount).replace(".", ","),
    entry.category,
    entry.id
  ].map(cell).join(";"));
  const blob = new Blob([`\uFEFF${["date;libelle;montant;categorie;id", ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${STORE_KEY}-${today()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  toast(`Copie enregistree : ${link.download}`);
}

/**
 * Parse une date au format JJ/MM/AAAA vers AAAA-MM-JJ.
 */
function parseFrenchDate(dateStr: string): string {
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return today();
  const [day, month, year] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return today();
  return `${year}-${month}-${day}`;
}

/**
 * Parse un montant au format francais (virgule decimale, espace milliers, negatif = depense).
 * Exemples : "-1 234,56" -> -1234.56, "42,00" -> 42
 */
function parseFrenchAmount(amountStr: string): number {
  // Supprimer les espaces (separateur de milliers) et remplacer la virgule par un point
  const cleaned = amountStr.trim().replace(/\s/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * Genere un identifiant unique pour une operation base sur ses caracteristiques.
 * Utilise pour la deduplication.
 */
function generateOperationKey(entry: Pick<Entry, "date" | "label" | "amount">): string {
  // Normaliser le libelle pour la comparaison
  const normalizedLabel = entry.label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${entry.date}|${normalizedLabel}|${entry.amount.toFixed(2)}`;
}

/**
 * Parse le contenu d'un fichier CSV bancaire francais.
 * Retourne les operations parsées (sans les doublons avec l'existant).
 */
export async function parseBankCsv(file: File): Promise<{ entries: Entry[]; duplicates: number }> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    toast("Le fichier CSV est vide ou ne contient que l'en-tete.", { tone: "error" });
    return { entries: [], duplicates: 0 };
  }

  // Detecter l'en-tete
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("date") && header.includes("libell") && header.includes("montant");
  
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const parsedEntries: Entry[] = [];
  const existingEntries = useEntries.getState().entries;
  const existingKeys = new Set(existingEntries.map(generateOperationKey));
  let duplicates = 0;

  for (const line of dataLines) {
    const columns = line.split(";");
    if (columns.length < 3) continue;

    const [dateStr, label, amountStr] = columns;
    const date = parseFrenchDate(dateStr);
    const amount = parseFrenchAmount(amountStr);
    const cleanLabel = label.trim();

    if (!cleanLabel || !Number.isFinite(amount)) continue;

    const category = categorize(cleanLabel, DEFAULT_CATEGORIES);
    const entry: Entry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      label: cleanLabel,
      amount,
      category,
      date,
    };

    const key = generateOperationKey(entry);
    if (existingKeys.has(key)) {
      duplicates++;
      continue;
    }

    existingKeys.add(key);
    parsedEntries.push(entry);
  }

  return { entries: parsedEntries, duplicates };
}

/**
 * Importe un fichier CSV bancaire et ajoute les operations (sans doublons).
 * Retourne le nombre d'operations importees.
 */
export async function importBankCsv(file: File): Promise<number> {
  const { entries, duplicates } = await parseBankCsv(file);
  
  if (!entries.length) {
    if (duplicates > 0) {
      toast(`${duplicates} operation(s) deja presente(s) ignoree(s).`, { tone: "error" });
    } else {
      toast("Aucune operation lisible dans ce fichier.", { tone: "error" });
    }
    return 0;
  }

  const before = useEntries.getState().entries;
  useEntries.setState({ entries: [...before, ...entries] });
  
  let message = `${entries.length} operation(s) importee(s)`;
  if (duplicates > 0) {
    message += `, ${duplicates} doublon(s) ignore(s)`;
  }
  message += ".";
  
  toast(message, {
    action: {
      label: "Annuler",
      run: () => useEntries.setState({ entries: before })
    }
  });
  
  return entries.length;
}

/**
 * Ouvre le selecteur de fichier pour importer un CSV bancaire.
 */
export function pickBankCsv(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void importBankCsv(file);
  });
  input.click();
}