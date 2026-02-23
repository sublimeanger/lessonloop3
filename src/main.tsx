// Env validation (non-fatal to prevent white screens)
import '@/lib/env';
import './lib/sentry'; // Initialise Sentry before anything else
import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
