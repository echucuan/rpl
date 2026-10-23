import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Published at https://echucuan.github.io/rpl/
export default defineConfig({
  base: "/rpl/",
  plugins: [react()],
});
