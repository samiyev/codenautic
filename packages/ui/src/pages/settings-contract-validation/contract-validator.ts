import type {
    IGuardrailRule,
    IGuardrailValidationResult,
    IValidationResult,
    TContractType,
} from "./contract-validation-types"

/**
 * Expected schema identifier for contract envelope validation.
 */
export const SUPPORTED_SCHEMA = "codenautic.contract.v1"

/**
 * Supported contract version numbers.
 */
export const SUPPORTED_VERSIONS: ReadonlyArray<number> = [1, 2]

/**
 * Parses and validates a JSON contract envelope string.
 *
 * @param rawValue - The raw JSON string to parse and validate.
 * @returns Validation result with errors, migration hints, and normalized envelope.
 */
export function parseContractEnvelope(rawValue: string): IValidationResult {
    let parsedValue: unknown
    try {
        parsedValue = JSON.parse(rawValue)
    } catch (_error: unknown) {
        return {
            errors: ["Invalid JSON format. Provide a valid JSON object."],
            migrationHints: [],
        }
    }

    if (typeof parsedValue !== "object" || parsedValue === null) {
        return {
            errors: ["Contract root must be an object envelope."],
            migrationHints: [],
        }
    }

    const candidate = parsedValue as {
        readonly schema?: unknown
        readonly version?: unknown
        readonly type?: unknown
        readonly payload?: unknown
    }

    const errors: Array<string> = []
    const migrationHints: Array<string> = []

    if (candidate.schema !== SUPPORTED_SCHEMA) {
        errors.push(`Unsupported schema. Expected "${SUPPORTED_SCHEMA}".`)
    }

    if (typeof candidate.version !== "number") {
        errors.push("Version is required and must be a number.")
    } else if (SUPPORTED_VERSIONS.includes(candidate.version) !== true) {
        errors.push(`Version ${String(candidate.version)} is not supported.`)
    }

    if (candidate.type !== "theme-library" && candidate.type !== "rules-library") {
        errors.push('Type must be either "theme-library" or "rules-library".')
    }

    if (candidate.payload === undefined) {
        errors.push("Payload is required.")
    }

    if (errors.length === 0 && typeof candidate.version === "number" && candidate.version === 1) {
        migrationHints.push(
            "Version 1 contract is accepted with migration. Add explicit `metadata` block for v2.",
        )
    }

    if (errors.length > 0) {
        return {
            errors,
            migrationHints,
        }
    }

    return {
        errors: [],
        migrationHints,
        normalizedEnvelope: {
            payload: candidate.payload,
            schema: candidate.schema as string,
            type: candidate.type as TContractType,
            version: candidate.version as number,
        },
    }
}

/**
 * Parses and validates YAML guardrails configuration and extracts import rules.
 *
 * @param rawYaml - The raw YAML string with guardrail rules.
 * @returns Validation errors and parsed guardrail rules.
 */
export function parseGuardrailsYaml(rawYaml: string): IGuardrailValidationResult {
    const errors: Array<string> = []
    const rules: Array<IGuardrailRule> = []

    const lines = rawYaml.replaceAll("\r\n", "\n").split("\n")
    let currentSource: string | undefined
    let currentTarget: string | undefined

    for (const [lineIndex, rawLine] of lines.entries()) {
        if (rawLine.includes("\t")) {
            errors.push(`Line ${String(lineIndex + 1)}: tabs are not allowed, use spaces.`)
            continue
        }

        const trimmedLine = rawLine.trim()
        if (trimmedLine.length === 0 || trimmedLine.startsWith("#") || trimmedLine === "rules:") {
            continue
        }

        const normalizedLine = trimmedLine.startsWith("- ")
            ? trimmedLine.slice(2).trim()
            : trimmedLine

        if (normalizedLine.startsWith("source:")) {
            const parsedSource = normalizedLine.slice("source:".length).trim()
            if (parsedSource.length === 0) {
                errors.push(`Line ${String(lineIndex + 1)}: source is required.`)
                continue
            }
            currentSource = parsedSource
            continue
        }

        if (normalizedLine.startsWith("target:")) {
            const parsedTarget = normalizedLine.slice("target:".length).trim()
            if (parsedTarget.length === 0) {
                errors.push(`Line ${String(lineIndex + 1)}: target is required.`)
                continue
            }
            currentTarget = parsedTarget
            continue
        }

        if (normalizedLine.startsWith("mode:")) {
            const parsedMode = normalizedLine.slice("mode:".length).trim()
            if (parsedMode !== "allow" && parsedMode !== "forbid") {
                errors.push(`Line ${String(lineIndex + 1)}: mode must be allow or forbid.`)
                continue
            }

            if (currentSource === undefined || currentTarget === undefined) {
                errors.push(
                    `Line ${String(
                        lineIndex + 1,
                    )}: guardrail rule must include source and target before mode.`,
                )
                continue
            }

            rules.push({
                id: `guardrail-rule-${String(lineIndex)}`,
                mode: parsedMode,
                source: currentSource,
                target: currentTarget,
            })
            currentSource = undefined
            currentTarget = undefined
            continue
        }

        errors.push(`Line ${String(lineIndex + 1)}: unsupported guardrail field.`)
    }

    if (rules.length === 0) {
        errors.push("Guardrails must include at least one rule.")
    }

    return {
        errors,
        rules,
    }
}
