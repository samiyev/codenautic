/**
 * Typed error codes for AST language detection failures.
 */
export const AST_LANGUAGE_DETECTION_ERROR_CODE = {
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    LANGUAGE_NOT_DETECTED: "LANGUAGE_NOT_DETECTED",
} as const

/**
 * AST language detection error code.
 */
export type AstLanguageDetectionErrorCode =
    (typeof AST_LANGUAGE_DETECTION_ERROR_CODE)[keyof typeof AST_LANGUAGE_DETECTION_ERROR_CODE]

/**
 * Additional metadata for AST language detection errors.
 */
export interface IAstLanguageDetectionErrorDetails {
    /**
     * Typed error code.
     */
    readonly code: AstLanguageDetectionErrorCode

    /**
     * Original file path input.
     */
    readonly filePath: string
}

/**
 * Typed error raised when AST language cannot be resolved.
 */
export class AstLanguageDetectionError extends Error {
    /**
     * Typed error code.
     */
    public readonly code: AstLanguageDetectionErrorCode

    /**
     * Original file path input.
     */
    public readonly filePath: string

    /**
     * Creates language detection error.
     *
     * @param message Human-readable error message.
     * @param details Typed error metadata.
     */
    public constructor(message: string, details: IAstLanguageDetectionErrorDetails) {
        super(message)
        this.name = "AstLanguageDetectionError"
        this.code = details.code
        this.filePath = details.filePath
    }
}
