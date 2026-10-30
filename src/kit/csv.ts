// Une copie des opérations pour un tableur (points-virgules et virgule décimale, comme Excel
// en français), et sa reprise sans doubler ce qui est déjà là.

import { parseAmount, parseBankAmount, parseBankDate, today } from "./format";
import { categorize } from "./categorize";
import { STORE_KEY, useEntries, type Entry } from "./store";
import { useCategorizeLearn } from "./categorize-learn";
import { toast } from "./toast";

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

function parse(text: string): string[][] {
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

/** Clé unique pour détecter les doublons : date + libellé + montant (arrondi à 2 décimales). */
function duplicateKey(entry: Entry): string {
  return `${entry.date}|${entry.label.trim().toLowerCase()}|${Math.round(entry.amount * 100)}`;
}

const names: Record<string, keyof Entry> = { date: "date", libelle: "label", label: "label", montant: "amount", amount: "amount", categorie: "category", category: "category", id: "id" };
const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Reprend un relevé bancaire (fichier .csv) ; rend le nombre d'opérations importées (nouvelles). */
export async function importBankCsv(file: File): Promise<number> {
  const [head, ...lines] = parse(await file.text());
  const fields = (head || []).map((title) => names[plain(title)]);
  
  const found = lines
    .map((cells) => Object.fromEntries(fields.map((field, index) => [field, (cells[index] || "").trim()])) as Record<string, string>)
    .filter((line) => line.label && line.date && Number.isFinite(parseBankAmount(line.amount)))
    .map((line): Entry => {
      const date = parseBankDate(line.date);
      const amount = parseBankAmount(line.amount);
      // Format bancaire standard : montants négatifs = dépenses, positifs = rentrées
      // On garde le signe tel quel
      const finalAmount = Math.round(amount * 100) / 100;
      const category = line.category || categorize(line.label);
      // Apprendre de l'import pour les futures suggestions
      if (!line.category) {
        useCategorizeLearn.getState().learn(line.label, category);
      }
      return {
        id: line.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        label: line.label,
        amount: finalAmount,
        category,
        date: date || today(),
      };
    });
  
  if (!found.length) {
    toast("Ce fichier ne contient aucune opération lisible.", { tone: "error" });
    return 0;
  }
  
  const before = useEntries.getState().entries;
  const existingKeys = new Set(before.map(duplicateKey));
  const newEntries = found.filter((entry) => !existingKeys.has(duplicateKey(entry)));
  
  if (newEntries.length === 0) {
    toast("Aucune nouvelle opération (toutes sont déjà importées).", { tone: "error" });
    return 0;
  }
  
  useEntries.setState({ entries: [...before, ...newEntries] });
  toast(`${newEntries.length} ${newEntries.length > 1 ? "nouvelles opérations importées" : "nouvelle opération importée"}`, {
    action: { label: "Annuler", run: () => useEntries.setState({ entries: before }) },
  });
  return newEntries.length;
}

/** Ouvre le choix d'un fichier, puis importe le relevé bancaire choisi. */
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

/** Reprend une copie (un fichier .csv choisi par l'utilisateur) ; rend le nombre d'opérations reprises. */
export async function importCsv(file: File): Promise<number> {
  const [head, ...lines] = parse(await file.text());
  const fields = (head || []).map((title) => names[plain(title)]);
  const found = lines
    .map((cells) => Object.fromEntries(fields.map((field, index) => [field, (cells[index] || "").trim()])) as Record<string, string>)
    .filter((line) => line.label && Number.isFinite(parseAmount(line.amount)))
    .map((line): Entry => ({
      id: line.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      label: line.label,
      amount: Math.round(parseAmount(line.amount) * 100) / 100,
      category: line.category || "",
      date: /^\d{4}-\d{2}-\d{2}$/.test(line.date || "") ? line.date : today(),
    }));
  if (!found.length) {
    toast("Ce fichier ne contient aucune opération lisible.", { tone: "error" });
    return 0;
  }
  const before = useEntries.getState().entries;
  const byId = new Map(before.map((entry) => [entry.id, entry]));
  for (const entry of found) byId.set(entry.id, entry);
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
