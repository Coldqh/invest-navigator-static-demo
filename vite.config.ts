import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveBase() {
    const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];

    if (process.env.GITHUB_ACTIONS === "true" && repository) {
        return `/${repository}/`;
    }

    return "/";
}

export default defineConfig({
    base: resolveBase(),
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true
    },
    preview: {
        host: "0.0.0.0",
        port: 4173,
        strictPort: true
    }
});
