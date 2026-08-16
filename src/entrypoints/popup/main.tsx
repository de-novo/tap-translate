import { createRoot } from "react-dom/client";
import { PopupApp } from "@/ui/popup/PopupApp";
import "@/styles/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(<PopupApp />);
