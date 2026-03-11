import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force fresh module resolution
createRoot(document.getElementById("root")!).render(<App />);
