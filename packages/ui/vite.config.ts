import {defineConfig} from "vite"
import react from "@vitejs/plugin-react"
import {TanStackRouterVite} from "@tanstack/router-plugin/vite"
import {sentryVitePlugin} from "@sentry/vite-plugin"
import path from "path"

export default defineConfig({
    plugins: [
        TanStackRouterVite({
            routesDirectory: "./src/routes",
            generatedRouteTree: "./src/routeTree.gen.ts",
        }),
        react(),
        sentryVitePlugin({
            org: process.env["SENTRY_ORG"],
            project: process.env["SENTRY_PROJECT"],
            authToken: process.env["SENTRY_AUTH_TOKEN"],
            disable: process.env["SENTRY_AUTH_TOKEN"] === undefined,
            sourcemaps: {
                filesToDeleteAfterUpload: ["**/*.map"],
            },
            telemetry: false,
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    server: {
        port: 3000,
    },
    build: {
        sourcemap: true,
    },
})
