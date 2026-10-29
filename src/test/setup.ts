// Configuration globale pour les tests
import { beforeEach, vi } from "vitest";
import { useEntries } from "../kit/store";

// Nettoyer le store avant chaque test
beforeEach(() => {
  useEntries.setState({ entries: [], month: "2026-10", fresh: null });
  localStorage.clear();
  vi.clearAllMocks();
});

// Mock pour File et FileReader
global.File = class File {
  constructor(public chunks: string[], public name: string, public options: { type: string } = { type: "text/csv" }) {}
  get size() { return this.chunks.join("").length; }
  text() { return Promise.resolve(this.chunks.join("")); }
  slice() { return new File(this.chunks, this.name, this.options); }
} as any;

global.FileReader = class FileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsText(file: File) {
    file.text().then(text => {
      this.result = text;
      this.onload?.();
    });
  }
} as any;