import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow the dev server to respond to per-store subdomains like
    // `kade-fashion-2.localtest.me`. A leading "." matches all subdomains.
    // `true` should mean "allow any", but Vite 5.4 enforces this stricter
    // list in some patch builds — an explicit allowlist is the reliable path.
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".localtest.me",
      ".local"
    ]
  }
});
