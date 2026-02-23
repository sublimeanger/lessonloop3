import '@/lib/env'; // Validate env vars before anything else
import './lib/sentry'; // Initialise Sentry before anything else
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
