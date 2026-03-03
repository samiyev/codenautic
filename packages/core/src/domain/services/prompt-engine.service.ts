import {ValidationError} from "../errors/validation.error"
import {Result} from "../../shared/result"

/**
 * Service for lightweight template rendering.
 */
export interface IPromptEngineConfig {
    /**
     * Max allowed template length.
     */
    readonly maxTemplateLength?: number
}

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g

/**
 * Engine for prompt templating.
 */
export class PromptEngineService {
    private static readonly DEFAULT_MAX_TEMPLATE_LENGTH = 20000

    private readonly maxTemplateLength: number

    /**
     * Creates prompt engine.
     *
     * @param config Optional engine config.
     */
    public constructor(config?: IPromptEngineConfig) {
        this.maxTemplateLength = Math.max(
            1,
            config?.maxTemplateLength ?? PromptEngineService.DEFAULT_MAX_TEMPLATE_LENGTH,
        )
    }

    /**
     * Renders template with variables.
     *
     * @param template Template source.
     * @param variables Variables for substitution.
     * @returns Rendered template string.
     * @throws ValidationError when template is invalid.
     */
    public render(template: string, variables: Record<string, unknown>): string {
        const validation = this.validate(template)
        if (validation.isFail) {
            throw validation.error
        }

        const values = normalizeVariablesMap(variables)
        return template.replace(
            TEMPLATE_VARIABLE_PATTERN,
            (match, variableName?: string): string => {
                if (variableName === undefined) {
                    return match
                }

                const normalized = normalizeVariableName(variableName)
                const lookup = resolveTemplateVariable(values, normalized)
                if (lookup.found === false) {
                    return ""
                }

                if (lookup.value === undefined || lookup.value === null) {
                    return ""
                }

                return normalizeTemplateValue(lookup.value)
            },
        )
    }

    /**
     * Validates template and extracted variable names.
     *
     * @param template Template source.
     * @returns Validation result.
     */
    public validate(template: string): Result<void, ValidationError> {
        if (typeof template !== "string") {
            return Result.fail(
                new ValidationError("Template validation failed", [{
                    field: "template",
                    message: "Template must be a string",
                }]),
            )
        }

        if (template.length === 0) {
            return Result.fail(
                new ValidationError("Template validation failed", [{
                    field: "template",
                    message: "Template must be non-empty",
                }]),
            )
        }

        if (template.length > this.maxTemplateLength) {
            return Result.fail(
                new ValidationError("Template validation failed", [{
                    field: "template",
                    message: `Template must be at most ${this.maxTemplateLength} characters`,
                }]),
            )
        }

        return Result.ok<void, ValidationError>(void 0)
    }

    /**
     * Extracts template variable names in appearance order.
     *
     * @param template Template source.
     * @returns Unique variable names.
     */
    public extractVariables(template: string): string[] {
        if (typeof template !== "string") {
            return []
        }

        const normalizedText = template.trim()
        if (normalizedText.length === 0) {
            return []
        }

        const variables = new Set<string>()
        for (const match of normalizedText.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
            const variableName = match[1]
            if (variableName === undefined) {
                continue
            }

            variables.add(normalizeVariableName(variableName))
        }

        return [...variables]
    }
}

/**
 * Normalizes raw variables map to string-keyed object.
 *
 * @param variables Input map.
 * @returns Raw variable map.
 */
function normalizeVariablesMap(variables: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const key in variables) {
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
            result[key.trim()] = variables[key]
        }
    }

    return result
}

/**
 * Safely converts template variable values to string.
 *
 * @param value Raw variable value.
 * @returns Printable representation.
 */
function normalizeTemplateValue(value: unknown): string {
    if (typeof value === "string") {
        return value
    }

    if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
        return `${value}`
    }

    if (value instanceof Date) {
        return value.toISOString()
    }

    return JSON.stringify(value) ?? ""
}

/**
 * Resolves template variable with dot path support.
 *
 * @param values Flat or nested variables map.
 * @param variableName Variable token.
 * @returns Resolution result.
 */
function resolveTemplateVariable(
    values: Record<string, unknown>,
    variableName: string,
): {found: boolean; value?: unknown} {
    const normalized = variableName.trim()
    if (Object.prototype.hasOwnProperty.call(values, normalized) === true) {
        return {found: true, value: values[normalized]}
    }

    const path = normalized.split(".")
    let current: unknown = values
    for (const pathPart of path) {
        if (typeof current !== "object" || current === null) {
            return {found: false}
        }

        if (pathPart.length === 0 || Object.prototype.hasOwnProperty.call(current, pathPart) === false) {
            return {found: false}
        }

        current = (current as Record<string, unknown>)[pathPart]
    }

    return {found: true, value: current}
}

/**
 * Normalizes variable token.
 *
 * @param value Raw variable token.
 * @returns Trimmed variable token.
 */
function normalizeVariableName(value: string): string {
    return value.trim()
}
