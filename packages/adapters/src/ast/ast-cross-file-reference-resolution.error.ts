/**
 * Typed error codes for AST cross-file reference resolution.
 */
export const AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE = {
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    EMPTY_FILES: "EMPTY_FILES",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MAX_CANDIDATES_PER_REFERENCE: "INVALID_MAX_CANDIDATES_PER_REFERENCE",
    INVALID_MINIMUM_CONFIDENCE: "INVALID_MINIMUM_CONFIDENCE",
} as const

/**
 * AST cross-file reference resolution error code literal.
 */
export type AstCrossFileReferenceResolutionErrorCode =
    (typeof AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE)[keyof typeof AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE]

/**
 * Structured metadata for AST cross-file reference resolution failures.
 */
export interface IAstCrossFileReferenceResolutionErrorDetails {
    /**
     * Invalid or duplicate repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid minimum confidence threshold when available.
     */
    readonly minimumConfidence?: number

    /**
     * Invalid max candidate count when available.
     */
    readonly maxCandidatesPerReference?: number
}

/**
 * Typed AST cross-file reference resolution error with stable metadata.
 */
export class AstCrossFileReferenceResolutionError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstCrossFileReferenceResolutionErrorCode

    /**
     * Invalid or duplicate repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid minimum confidence threshold when available.
     */
    public readonly minimumConfidence?: number

    /**
     * Invalid max candidate count when available.
     */
    public readonly maxCandidatesPerReference?: number

    /**
     * Creates typed AST cross-file reference resolution error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstCrossFileReferenceResolutionErrorCode,
        details: IAstCrossFileReferenceResolutionErrorDetails = {},
    ) {
        super(createAstCrossFileReferenceResolutionErrorMessage(code, details))

        this.name = "AstCrossFileReferenceResolutionError"
        this.code = code
        this.filePath = details.filePath
        this.minimumConfidence = details.minimumConfidence
        this.maxCandidatesPerReference = details.maxCandidatesPerReference
    }
}

/**
 * Builds stable public message for AST cross-file reference resolution failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstCrossFileReferenceResolutionErrorMessage(
    code: AstCrossFileReferenceResolutionErrorCode,
    details: IAstCrossFileReferenceResolutionErrorDetails,
): string {
    return AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_MESSAGES[code](details)
}

const AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_MESSAGES: Readonly<
    Record<
        AstCrossFileReferenceResolutionErrorCode,
        (details: IAstCrossFileReferenceResolutionErrorDetails) => string
    >
> = {
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate file path for AST cross-file reference resolution: ${details.filePath ?? "<empty>"}`,
    EMPTY_FILES: () => "Parsed source file collection for AST cross-file reference resolution cannot be empty",
    EMPTY_FILE_PATHS: () => "AST cross-file reference resolution file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for AST cross-file reference resolution: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_CANDIDATES_PER_REFERENCE: (details) =>
        `Invalid max candidates per reference for AST cross-file reference resolution: ${
            details.maxCandidatesPerReference ?? Number.NaN
        }`,
    INVALID_MINIMUM_CONFIDENCE: (details) =>
        `Invalid minimum confidence for AST cross-file reference resolution: ${
            details.minimumConfidence ?? Number.NaN
        }`,
}
