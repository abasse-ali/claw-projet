/**
 * Application de partage des dépenses de voyage entre amis.
 * Pour téléphone : ajouter participants, dépenses, soldes et remboursements.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useEntries, seedOnce } from "./kit";
import "./index.css";

export default function App() {
  /** Initialiser les données seed au premier lancement seulement */
  seedOnce([]);

  const { entries, participants, addParticipant, removeParticipant, renameParticipant } = useEntries();

  /** Calcule le solde de chaque participant : whatTheyPaid - theirShare */
  const computeBalances = (): Map<string, number> => {
    const balanceMap = new Map<string, number>();
    participants.forEach((p) => balanceMap.set(p.id, 0));

    entries.forEach((entry) => {
      const amount = entry.amount;
      // Déterminer le payeur : string (depuis CSV ou "tout_le_monde") ou Participant object
      let payerId: string;
      if (typeof entry.payer === "string") {
        payerId = entry.payer;
      } else if (entry.payer && typeof entry.payer === "object" && "id" in entry.payer) {
        payerId = entry.payer.id;
      } else {
        payerId = "tout_le_monde";
      }

      const forWhom = entry.forWhom;

      // Déterminer pour qui cette dépense est faite
      let recipients: string[];
      if (forWhom === "tout_le_monde" || (Array.isArray(forWhom) && forWhom.length === 0)) {
        recipients = participants.map((p) => p.id);
      } else if (Array.isArray(forWhom)) {
        // Extraire seulement les IDs des participants
        recipients = forWhom.map((p) => (typeof p === "string" ? p : p.id));
      } else {
        recipients = [forWhom as string];
      }

      const share = recipients.length > 0 ? Math.round((amount / recipients.length) * 100) / 100 : 0;

      if (payerId !== "tout_le_monde" && recipients.length > 0) {
        const currentPayerBal = balanceMap.get(payerId) ?? 0;
        balanceMap.set(payerId, currentPayerBal - share);
        recipients.forEach((rid) => {
          const currentRecBal = balanceMap.get(rid) ?? 0;
          balanceMap.set(rid, currentRecBal + share);
        });
      }
    });

    return balanceMap;
  };

  /** Génère les remboursements minimums */
  const computeSettlements = (): Array<{from: string, to: string, amount: number}> => {
    const balances = computeBalances();
    const positives: Array<{id: string, amount: number}> = [];
    const negatives: Array<{id: string, amount: number}> = [];

    participants.forEach((p) => {
      const bal = balances.get(p.id) || 0;
      if (bal > 0) positives.push({ id: p.id, amount: bal });
      else if (bal < 0) negatives.push({ id: p.id, amount: Math.abs(bal) });
    });

    const posSorted = positives.sort((a, b) => b.amount - a.amount);
    const negSorted = negatives.sort((a, b) => a.amount - b.amount);

    const settlements: Array<{from: string, to: string, amount: number}> = [];
    let pi = 0, ni = 0;

    while (pi < posSorted.length && ni < negSorted.length) {
      const payer = posSorted[pi];
      const receiver = negSorted[ni];
      const transfer = Math.min(payer.amount, receiver.amount);

      if (transfer > 0) {
        settlements.push({ from: receiver.id, to: payer.id, amount: transfer });
        payer.amount -= transfer;
        receiver.amount -= transfer;
        if (payer.amount > 0) pi++;
        if (receiver.amount > 0) ni++;
      } else {
        if (payer.amount === 0) pi++;
        if (receiver.amount === 0) ni++;
      }
    }

    return settlements;
  };

  /** Affiche les participants trouvés avec sécurité */
  const ParticipantName = (id: string | undefined) => {
    if (!id) return "";
    const p = participants.find((p) => p.id === id);
    return p ? p.name : "";
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Partage de dépenses</h1>
        <p>Voyage entre amis</p>
      </header>

      <main className="app-main">
        <section className="participants-screen">
          <h2>Participants</h2>
          <div className="participants-list">
            {participants.map((participant) => (
              <div key={participant.id} className="participant-row">
                <span className="participant-name">{participant.name}</span>
                <button
                  className="btn btn--small btn--danger"
                  onClick={() => removeParticipant(participant.id)}
                >
                  Supprimer
                </button>
              </div>
            ))}

            <div className="participant-form">
              <input
                type="text"
                placeholder="Prénom..."
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.trim()) {
                    addParticipant(value.trim());
                  }
                }}
                aria-label="Nouveau participant"
              />
            </div>
          </div>
        </section>

        <section className="balances-screen">
          <h2>Soldes</h2>
          <p>La somme de tous les soldes fait toujours 0,00 €</p>

          <div className="balances-grid">
            {participants.map((participant) => {
              const balance = computeBalances().get(participant.id) || 0;
              return (
                <div key={participant.id} className="balance-item">
                  <span className="balance-name">{participant.name}</span>
                  <span className="balance-value">{balance.toLocaleString("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} €</span>
                </div>
              );
            })}
          </div>

          <div className="settlements-section">
            <h3>Qui doit combien à qui</h3>
            <p>
              {computeSettlements().length} virement{
                computeSettlements().length > 1 ? "" : ""
              } nécessaire(s) pour équilibrer
            </p>

            <ul className="settlements-list">
              {computeSettlements().map((settlement) => (
                <li key={`${settlement.from}-${settlement.to}`} className="settlement-item">
                  <span>{participants.find((p) => p.id === settlement.from)?.name}</span>
                  <span>doit</span>
                  <span>{settlement.amount.toLocaleString("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} €</span>
                  <span>à</span>
                  <span>{participants.find((p) => p.id === settlement.to)?.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);