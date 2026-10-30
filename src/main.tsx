/**
 * Application de partage des dépenses de voyage entre amis.
 * Pour téléphone : ajouter participants, dépenses, soldes et remboursements.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);