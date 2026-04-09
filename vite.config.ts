import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    return {
        base: "/",
        plugins: [
            react(),
            federation({
                name: "tgnpdcl-demo",
                remotes: {
                    SuperAdmin: env.VITE_SUPER_ADMIN_URL ?? "https://admin.bestinfra.app/assets/remoteEntry.js",
                },
                shared: ["react", "react-dom", "react-router", "react-router-dom"],
            }),
        ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@api": path.resolve(__dirname, "./src/api"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@pages": path.resolve(__dirname, "./src/pages"),
            "@context": path.resolve(__dirname, "./src/context"),
            "@utils": path.resolve(__dirname, "./src/utils"),
            "@hooks": path.resolve(__dirname, "./src/hooks"),
            "@types": path.resolve(__dirname, "./src/types"),
        },
    },
    build: {
        modulePreload: false,
        target: "esnext",
        minify: false,
        cssCodeSplit: false,
        outDir: "dist",
    },
    server: {
        port: 1700,
        fs: {
            allow: [".."],
        },
        proxy: {
          '/api': {
            target: 'http://localhost:4313',
            changeOrigin: true,
            secure: false,
          }
        }
    },
    publicDir: "public",
    };
});
