/**
 * CLI migration: загружает seed данные через Admin API.
 *
 * Использование: bun run migrate:seed
 *
 * Env:
 *   MIGRATION_API_URL   — базовый URL API (default: http://localhost:3000)
 *   MIGRATION_ADMIN_TOKEN — admin API key (default: "" — dev mode)
 */
import {resolve} from "path"

interface IMigrationConfig {
    apiUrl: string
    adminToken: string
    retryAttempts: number
    retryDelayMs: number
}

interface IImportResult {
    created: number
    updated: number
    skipped: number
}

interface IResourceResult {
    resource: string
    result: IImportResult
    durationMs: number
}

const IMPORT_ORDER = [
    {resource: "categories", endpoint: "/admin/import/categories", file: "categories.json"},
    {resource: "rules", endpoint: "/admin/import/rules", file: "rules.json"},
    {resource: "prompts", endpoint: "/admin/import/prompts", file: "prompts.json"},
    {
        resource: "expert-panels",
        endpoint: "/admin/import/expert-panels",
        file: "expert-panels.json",
    },
    {resource: "settings", endpoint: "/admin/import/settings", file: "settings.json"},
] as const

function parseConfig(): IMigrationConfig {
    return {
        apiUrl: process.env["MIGRATION_API_URL"] ?? "http://localhost:3000",
        adminToken: process.env["MIGRATION_ADMIN_TOKEN"] ?? "",
        retryAttempts: 3,
        retryDelayMs: 2000,
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    return "Unknown error"
}

async function waitForApi(config: IMigrationConfig): Promise<void> {
    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
        try {
            const response = await fetch(`${config.apiUrl}/health`, {
                signal: AbortSignal.timeout(5000),
            })
            if (response.ok) {
                return
            }
        } catch {
            /** Network error — retry */
        }
        if (attempt < config.retryAttempts) {
            console.error(
                `  API not ready, retrying in ${config.retryDelayMs}ms... (${attempt}/${config.retryAttempts})`,
            )
            await sleep(config.retryDelayMs)
        }
    }
    console.error(
        "ERROR: API is not available. Check MIGRATION_API_URL and ensure the server is running.",
    )
    process.exit(1)
}

async function importResource(
    config: IMigrationConfig,
    endpoint: string,
    data: unknown,
): Promise<IImportResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
        try {
            const response = await fetch(`${config.apiUrl}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-api-key": config.adminToken,
                },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(120000),
            })

            if (!response.ok) {
                const body = await response.text()
                throw new Error(`HTTP ${response.status}: ${body}`)
            }

            return (await response.json()) as IImportResult
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            if (attempt < config.retryAttempts) {
                const delay = config.retryDelayMs * Math.pow(2, attempt - 1)
                console.error(
                    `  Retry ${attempt}/${config.retryAttempts} for ${endpoint} in ${delay}ms...`,
                )
                await sleep(delay)
            }
        }
    }

    throw lastError ?? new Error(`Failed to import ${endpoint}`)
}

function buildReport(results: IResourceResult[]): string {
    const lines: string[] = ["", "=== Migration Report ===", ""]

    let totalCreated = 0
    let totalUpdated = 0
    let totalSkipped = 0

    for (const r of results) {
        const {created, updated, skipped} = r.result
        totalCreated += created
        totalUpdated += updated
        totalSkipped += skipped
        lines.push(
            `  ${r.resource.padEnd(12)} created: ${created}, updated: ${updated}, skipped: ${skipped} (${r.durationMs}ms)`,
        )
    }

    lines.push("")
    lines.push(
        `  Total:       created: ${totalCreated}, updated: ${totalUpdated}, skipped: ${totalSkipped}`,
    )
    lines.push("")

    return lines.join("\n")
}

async function main(): Promise<void> {
    const config = parseConfig()
    const defaultsDir = resolve(import.meta.dir, "defaults")

    console.error("Migration: seed default data via Admin API")
    console.error(`  API URL: ${config.apiUrl}`)
    console.error("")

    console.error("Checking API availability...")
    await waitForApi(config)
    console.error("  API is ready.")
    console.error("")

    const results: IResourceResult[] = []

    for (const {resource, endpoint, file} of IMPORT_ORDER) {
        console.error(`Importing ${resource}...`)
        const start = performance.now()

        const filePath = `${defaultsDir}/${file}`
        const fileContent = Bun.file(filePath)
        const exists = await fileContent.exists()

        if (!exists) {
            console.error(`  ERROR: File not found: ${filePath}`)
            process.exit(1)
        }

        const data: unknown = await fileContent.json()
        const result = await importResource(config, endpoint, data)
        const durationMs = Math.round(performance.now() - start)

        results.push({resource, result, durationMs})
        console.error(
            `  Done: created=${result.created}, updated=${result.updated}, skipped=${result.skipped} (${durationMs}ms)`,
        )
    }

    console.error(buildReport(results))
}

/** Автозапуск только при прямом вызове (не при импорте из тестов). */
const isDirectRun = import.meta.path === Bun.main

if (isDirectRun) {
    main().catch((error: unknown) => {
        const message = toErrorMessage(error)
        console.error(`FATAL: ${message}`)
        process.exit(1)
    })
}

export {parseConfig, buildReport, importResource, waitForApi}
export type {IMigrationConfig, IImportResult, IResourceResult}
