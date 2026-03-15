/**
 * Typed error codes for AST impact radius calculator.
 */
export const AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE = {
    EMPTY_CHANGED_FILE_PATHS: "EMPTY_CHANGED_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_DIRECTION: "INVALID_DIRECTION",
    INVALID_MAX_DEPTH: "INVALID_MAX_DEPTH",
    INVALID_MAX_AFFECTED_FILES: "INVALID_MAX_AFFECTED_FILES",
} as const

/**
 * AST impact radius calculator error code literal.
 */
export type AstImpactRadiusCalculatorErrorCode =
    (typeof AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE)[keyof typeof AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE]

/**
 * Structured metadata for AST impact radius calculator failures.
 */
export interface IAstImpactRadiusCalculatorErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid traversal direction when available.
     */
    readonly direction?: string

    /**
     * Invalid max depth value when available.
     */
    readonly maxDepth?: number

    /**
     * Invalid max affected files value when available.
     */
    readonly maxAffectedFiles?: number
}

/**
 * Typed AST impact radius calculator error with stable metadata.
 */
export class AstImpactRadiusCalculatorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstImpactRadiusCalculatorErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid traversal direction when available.
     */
    public readonly direction?: string

    /**
     * Invalid max depth value when available.
     */
    public readonly maxDepth?: number

    /**
     * Invalid max affected files value when available.
     */
    public readonly maxAffectedFiles?: number

    /**
     * Creates typed AST impact radius calculator error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstImpactRadiusCalculatorErrorCode,
        details: IAstImpactRadiusCalculatorErrorDetails = {},
    ) {
        super(createAstImpactRadiusCalculatorErrorMessage(code, details))

        this.name = "AstImpactRadiusCalculatorError"
        this.code = code
        this.filePath = details.filePath
        this.direction = details.direction
        this.maxDepth = details.maxDepth
        this.maxAffectedFiles = details.maxAffectedFiles
    }
}

/**
 * Builds stable public message for AST impact radius calculator failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstImpactRadiusCalculatorErrorMessage(
    code: AstImpactRadiusCalculatorErrorCode,
    details: IAstImpactRadiusCalculatorErrorDetails,
): string {
    return AST_IMPACT_RADIUS_CALCULATOR_ERROR_MESSAGES[code](details)
}

const AST_IMPACT_RADIUS_CALCULATOR_ERROR_MESSAGES: Readonly<
    Record<AstImpactRadiusCalculatorErrorCode, (details: IAstImpactRadiusCalculatorErrorDetails) => string>
> = {
    EMPTY_CHANGED_FILE_PATHS: () => "Impact radius calculator changed file path list cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for impact radius calculator: ${details.filePath ?? "<empty>"}`,
    INVALID_DIRECTION: (details) =>
        `Invalid direction for impact radius calculator: ${details.direction ?? "<empty>"}`,
    INVALID_MAX_DEPTH: (details) =>
        `Invalid max depth for impact radius calculator: ${details.maxDepth ?? Number.NaN}`,
    INVALID_MAX_AFFECTED_FILES: (details) =>
        `Invalid max affected files for impact radius calculator: ${
            details.maxAffectedFiles ?? Number.NaN
        }`,
}
