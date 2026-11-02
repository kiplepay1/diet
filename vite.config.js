import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Actions sets this automatically for project Pages sites.
  base: process.env.VITE_BASE_PATH || "/",
  server: { host: "0.0.0.0" }
});
