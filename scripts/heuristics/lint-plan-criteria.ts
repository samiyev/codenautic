import {readFileSync, readdirSync, statSync} from "node:fs"
import {resolve, relative} from "node:path"

interface IHeuristicRegistryEntry {
    source_file: string
    source_line: number
    status: string
}

interface IRegistryDocument {
    entries: IHeuristicRegistryEntry[]
}

interface IPlanLintFinding {
    filePath: string
    lineNumber: number
    reason: string
    line: string
}

const REGISTRY_JSON_PATH = "docs/heuristics/heuristics-registry.json"
const SCAN_IGNORES = new Set([".git", "node_modules", "dist", "coverage", ".idea"])

function main(): void {
    const planFiles = discoverPlanFiles()
    const coveredLocations = loadCoveredLocations()

    const findings: IPlanLintFinding[] = []

    for (const filePath of planFiles) {
        const fileContent = readFileSync(resolve(process.cwd(), filePath), "utf8")
        const lines = fileContent.split(/\r?\n/)

        lines.forEach((line, index) => {
            const reason = detectPatternViolation(line)
            if (reason === null) {
                return
            }

            const locationKey = `${filePath}:${index + 1}`
            if (coveredLocations.has(locationKey)) {
                return
            }

            findings.push({
                filePath,
                lineNumber: index + 1,
                reason,
                line: line.trim(),
            })
        })
    }

    if (findings.length > 0) {
        const preview = findings.slice(0, 20)
        const formatted = preview
            .map((finding) => {
                return `${finding.filePath}:${finding.lineNumber} [${finding.reason}] ${finding.line}`
            })
            .join("\n")

        throw new Error(
            `Plan criteria lint failed with ${findings.length} issue(s). Missing registry coverage for anti-pattern lines:\n${formatted}`,
        )
    }

    process.stdout.write(`Plan criteria lint passed (${planFiles.length} files scanned)\n`)
}

function discoverPlanFiles(): string[] {
    const repositoryRoot = process.cwd()
    const allFiles = walkDirectory(repositoryRoot)

    return allFiles.filter((filePath) => {
        if (filePath === "ROADMAP.md" || filePath === "PRODUCT.md") {
            return true
        }

        if (filePath.startsWith("packages/") && filePath.endsWith("/TODO.md")) {
            return true
        }

        if (filePath.startsWith("packages/") && filePath.includes("/todo/") && filePath.endsWith(".md")) {
            return true
        }

        if (filePath.startsWith("docs/ddd/") && filePath.endsWith(".md")) {
            return true
        }

        return false
    })
}

function walkDirectory(rootDirectory: string): string[] {
    const files: string[] = []
    const stack: string[] = [rootDirectory]

    while (stack.length > 0) {
        const currentDirectory = stack.pop()
        if (currentDirectory === undefined) {
            continue
        }

        const entries = readdirSync(currentDirectory)
        for (const entry of entries) {
            if (SCAN_IGNORES.has(entry)) {
                continue
            }

            const absolutePath = resolve(currentDirectory, entry)
            const relativePath = toPosix(relative(process.cwd(), absolutePath))
            const stats = statSync(absolutePath)

            if (stats.isDirectory()) {
                stack.push(absolutePath)
                continue
            }

            if (stats.isFile()) {
                files.push(relativePath)
            }
        }
    }

    return files.sort((left, right) => left.localeCompare(right))
}

function loadCoveredLocations(): Set<string> {
    const rawRegistry = readFileSync(resolve(process.cwd(), REGISTRY_JSON_PATH), "utf8")
    const parsed = JSON.parse(rawRegistry) as Partial<IRegistryDocument>

    if (!Array.isArray(parsed.entries)) {
        throw new Error("heuristics-registry.json must contain entries array")
    }

    const covered = new Set<string>()

    for (const entry of parsed.entries) {
        if (entry.status === "UNTRIAGED") {
            continue
        }
        covered.add(`${entry.source_file}:${entry.source_line}`)
    }

    return covered
}

function detectPatternViolation(line: string): string | null {
    if (/корректно\s+обрабатывает/i.test(line)) {
        return "ambiguous-handling-phrase"
    }

    if (/\bthreshold\b/i.test(line) && !hasNumericUnit(line)) {
        return "threshold-without-unit"
    }

    const hasScoreLikeTerm = /\b(confidence|risk|score)\b/i.test(line)
    if (hasScoreLikeTerm && isSpecificationLine(line) && !hasFormulaOrSourceHint(line)) {
        return "score-without-formula"
    }

    return null
}

function hasNumericUnit(line: string): boolean {
    return /(\d|%|ms|sec|min|hour|day|>=|<=|>|<)/i.test(line)
}

function isSpecificationLine(line: string): boolean {
    return /Готово, если|Acceptance Criteria/i.test(line)
}

function hasFormulaOrSourceHint(line: string): boolean {
    return /formula|calibration|predicted|actual|weights?|based\s+on|trend|источник|формула/i.test(line)
}

function toPosix(pathValue: string): string {
    return pathValue.replaceAll("\\", "/")
}

main()
