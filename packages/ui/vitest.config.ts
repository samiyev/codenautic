import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vitest/config"

import { loadUiServicePorts } from "./config/service-ports"

const servicePorts = loadUiServicePorts(__dirname)

export default defineConfig({
    plugins: [react()],
    define: {
        __CODENAUTIC_UI_PORT__: JSON.stringify(servicePorts.ui),
        __CODENAUTIC_API_PORT__: JSON.stringify(servicePorts.api),
        __CODENAUTIC_UI_PREVIEW_PORT__: JSON.stringify(servicePorts.uiPreview),
    },
    test: {
        environment: "happy-dom",
        globals: false,
        globalSetup: ["./tests/global-setup.ts"],
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/**/*.test.{ts,tsx}"],
        deps: {
            optimizer: {
                web: {
                    include: [
                        "@heroui/react",
                        "@heroui/styles",
                        "@tanstack/react-query",
                        "@tanstack/react-router",
                        "@tanstack/react-virtual",
                        "recharts",
                        "react-hook-form",
                        "lucide-react",
                        "i18next",
                        "react-i18next",
                        "sonner",
                    ],
                },
            },
        },
        coverage: {
            provider: "v8",
            thresholds: {
                lines: 91,
                functions: 93,
            },
            exclude: [
                "**/dist/**",
                "**/node_modules/**",
                "**/tests/**",
                "**/components/ui/**",
                "**/messages/**",
                "**/mock-data/**",
                "**/index.ts",
                "**/*.types.ts",
                "**/codecity-3d-scene-renderer.tsx",
                "**/i18n/locales/**",
                "**/components/icons/**",
            ],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
})
