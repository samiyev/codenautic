/**
 * Typed error codes for AST scan progress reporter.
 */
export const AST_SCAN_PROGRESS_REPORTER_ERROR_CODE = {
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_ON_SNAPSHOT: "INVALID_ON_SNAPSHOT",
    INVALID_PROCESSED_FILES: "INVALID_PROCESSED_FILES",
    INVALID_TOTAL_FILES: "INVALID_TOTAL_FILES",
    SNAPSHOT_CALLBACK_FAILED: "SNAPSHOT_CALLBACK_FAILED",
} as const

/**
 * AST scan progress reporter error code literal.
 */
export type AstScanProgressReporterErrorCode =
    (typeof AST_SCAN_PROGRESS_REPORTER_ERROR_CODE)[keyof typeof AST_SCAN_PROGRESS_REPORTER_ERROR_CODE]

/**
 * Structured metadata for AST scan progress reporter failures.
 */
export interface IAstScanProgressReporterErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid numeric value when available.
     */
    readonly value?: number

    /**
     * Underlying callback failure message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST scan progress reporter error with stable metadata.
 */
export class AstScanProgressReporterError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstScanProgressReporterErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid numeric value when available.
     */
    public readonly value?: number

    /**
     * Underlying callback failure message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST scan progress reporter error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured metadata payload.
     */
    public constructor(
        code: AstScanProgressReporterErrorCode,
        details: IAstScanProgressReporterErrorDetails = {},
    ) {
        super(createAstScanProgressReporterErrorMessage(code, details))

        this.name = "AstScanProgressReporterError"
        this.code = code
        this.filePath = details.filePath
        this.value = details.value
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for scan progress reporter failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured metadata payload.
 * @returns Stable public message.
 */
function createAstScanProgressReporterErrorMessage(
    code: AstScanProgressReporterErrorCode,
    details: IAstScanProgressReporterErrorDetails,
): string {
    return AST_SCAN_PROGRESS_REPORTER_ERROR_MESSAGES[code](details)
}

const AST_SCAN_PROGRESS_REPORTER_ERROR_MESSAGES: Readonly<
    Record<
        AstScanProgressReporterErrorCode,
        (details: IAstScanProgressReporterErrorDetails) => string
    >
> = {
    INVALID_FILE_PATH: (details) =>
        `Invalid filePath for scan progress reporter: ${details.filePath ?? "<empty>"}`,
    INVALID_ON_SNAPSHOT: () =>
        "Scan progress reporter onSnapshot must be a function when provided",
    INVALID_PROCESSED_FILES: (details) =>
        `Invalid processedFiles for scan progress reporter: ${details.value ?? Number.NaN}`,
    INVALID_TOTAL_FILES: (details) =>
        `Invalid totalFiles for scan progress reporter: ${details.value ?? Number.NaN}`,
    SNAPSHOT_CALLBACK_FAILED: (details) =>
        `Scan progress reporter callback failed: ${details.causeMessage ?? "<unknown>"}`,
}
