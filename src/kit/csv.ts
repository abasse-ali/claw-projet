// Une copie des opérations pour un tableur (points-virgules et virgule décimale, comme Excel
// en français), et sa reprise sans doubler ce qui est déjà là.

import { parseAmount, today } from "./format";
import { STORE_KEY, useEntries, type Entry } from "./store";
import { toast } from "./toast";
import { categorizeEntries } from "./categorize";

/** Génère un ID déterministe à partir des données de l'opération pour la déduplication. */
function generateEntryId(date: string, label: string, amount: number): string {
  const base = `${date}|${label}|${amount}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return `entry-${Math.abs(hash).toString(36)}`;
}

/** Parse une date au format JJ/MM/AAAA vers AAAA-MM-JJ. */
function parseFrenchDate(dateStr: string): string | null {
  const match = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  // Validation basique
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Vérification plus précise des jours par mois
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const cell = (value: unknown) => {
  const text = String(value ?? "");
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Enregistre la copie sur le téléphone (« appli-2026-10-28.csv »). */
export function exportCsv(): void {
  const entries = useEntries.getState().entries;
  const lines = entries.map((entry) => [entry.date, entry.label, String(entry.amount).replace(".", ","), entry.category, entry.id].map(cell).join(";"));
  const blob = new Blob([`﻿${["date;libellé;montant;catégorie;id", ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${STORE_KEY}-${today()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  toast(`Copie enregistrée : ${link.download}`);
}

export function parse(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const first = body.split(/\r?\n/, 1)[0];
  const separator = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quoted) {
      if (char === '"' && body[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { cells.push(value); value = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[index + 1] === "\n") index += 1;
      cells.push(value); rows.push(cells); cells = []; value = "";
    } else value += char;
  }
  if (value || cells.length) { cells.push(value); rows.push(cells); }
  return rows.filter((line) => line.some((text) => text.trim()));
}

const names: Record<string, keyof Entry> = { date: "date", libelle: "label", label: "label", montant: "amount", amount: "amount", categorie: "category", category: "category", id: "id" };
const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Reprend une copie (un fichier .csv choisi par l'utilisateur) ; rend le nombre d'opérations reprises. */
export async function importCsv(file: File): Promise<number> {
  const [head, ...lines] = parse(await file.text());
  const fields = (head || []).map((title) => names[plain(title)]);
  const found = lines
    .map((cells) => Object.fromEntries(fields.map((field, index) => [field, (cells[index] || "").trim()])) as Record<string, string>)
    .filter((line) => line.label && Number.isFinite(parseAmount(line.amount)))
    .map((line): Entry => {
      const amount = Math.round(parseAmount(line.amount) * 100) / 100;
      // Parse date from French format DD/MM/YYYY
      const parsedDate = line.date ? parseFrenchDate(line.date) : null;
      const date = parsedDate || (line.date && /^\d{4}-\d{2}-\d{2}$/.test(line.date) ? line.date : today());
      // Generate deterministic ID for deduplication
      const id = line.id || generateEntryId(date, line.label, amount);
      return {
        id,
        label: line.label,
        amount,
        category: line.category || "",
        date,
      };
    });
  if (!found.length) {
    toast("Ce fichier ne contient aucune opération lisible.", { tone: "error" });
    return 0;
  }
  // Auto-categorize entries that don't have a category
  const categorized = categorizeEntries(found);
  const before = useEntries.getState().entries;
  const byId = new Map(before.map((entry) => [entry.id, entry]));
  for (const entry of categorized) {
    const existing = byId.get(entry.id);
    // Preserve existing category if entry already exists and has a category
    if (existing && existing.category) {
      byId.set(entry.id, { ...entry, category: existing.category });
    } else {
      byId.set(entry.id, entry);
    }
  }
  useEntries.setState({ entries: [...byId.values()] });
  toast(`${found.length} ${found.length > 1 ? "opérations reprises" : "opération reprise"}`, {
    action: { label: "Annuler", run: () => useEntries.setState({ entries: before }) },
  });
  return found.length;
}

/** Ouvre le choix d'un fichier, puis reprend la copie choisie. */
export function pickCsv(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void importCsv(file);
  });
  input.click();
}
