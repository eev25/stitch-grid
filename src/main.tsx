/* ============================================================
   main.tsx — Vite entry point.
   Ported from design-reference/main.jsx (ReactDOM.createRoot call).
   ============================================================ */
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(<App />);
