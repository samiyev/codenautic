import type {SupportedLanguage} from "@codenautic/core"

/**
 * Typed error codes for AST parser factory failures.
 */
export const AST_PARSER_FACTORY_ERROR_CODE = {
    UNKNOWN_LANGUAGE: "UNKNOWN_LANGUAGE",
    LANGUAGE_NOT_SUPPORTED: "LANGUAGE_NOT_SUPPORTED",
    PARSER_CREATION_FAILED: "PARSER_CREATION_FAILED",
} as const

/**
 * AST parser factory error code.
 */
export type AstParserFactoryErrorCode =
    (typeof AST_PARSER_FACTORY_ERROR_CODE)[keyof typeof AST_PARSER_FACTORY_ERROR_CODE]

/**
 * Additional metadata for AST parser factory errors.
 */
export interface IAstParserFactoryErrorDetails {
    /**
     * Canonical language when raw input was recognized.
     */
    readonly normalizedLanguage?: SupportedLanguage

    /**
     * Optional failure cause message from lower-level creator.
     */
    readonly causeMessage?: string
}

/**
 * Typed error raised by AST parser factory.
 */
export class AstParserFactoryError extends Error {
    /**
     * Typed error code.
     */
    public readonly code: AstParserFactoryErrorCode

    /**
     * Raw language input that triggered error.
     */
    public readonly language: string

    /**
     * Canonical language when input was successfully normalized.
     */
    public readonly normalizedLanguage?: SupportedLanguage

    /**
     * Lower-level failure message when parser creation crashed.
     */
    public readonly causeMessage?: string

    /**
     * Creates factory error.
     *
     * @param code Typed error code.
     * @param language Raw language input.
     * @param details Optional normalized language and failure metadata.
     */
    public constructor(
        code: AstParserFactoryErrorCode,
        language: string,
        details: IAstParserFactoryErrorDetails = {},
    ) {
        super(buildMessage(code, language))
        this.name = "AstParserFactoryError"
        this.code = code
        this.language = language
        this.normalizedLanguage = details.normalizedLanguage
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable error message for factory failures.
 *
 * @param code Error code.
 * @param language Raw language input.
 * @returns Error message.
 */
function buildMessage(code: AstParserFactoryErrorCode, language: string): string {
    const normalizedLanguage = language.trim()
    const languageLabel = normalizedLanguage.length > 0 ? normalizedLanguage : "<empty>"

    if (code === AST_PARSER_FACTORY_ERROR_CODE.UNKNOWN_LANGUAGE) {
        return `Unknown AST parser language: ${languageLabel}`
    }

    if (code === AST_PARSER_FACTORY_ERROR_CODE.LANGUAGE_NOT_SUPPORTED) {
        return `AST parser is not supported for language: ${languageLabel}`
    }

    return `Failed to create AST parser for language: ${languageLabel}`
}
