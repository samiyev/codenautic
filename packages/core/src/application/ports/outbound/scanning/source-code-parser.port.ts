import type {IParsedSourceFileDTO, SupportedLanguage} from "../../../dto/ast"

/**
 * Input payload for source-code parser adapters.
 */
export interface ISourceCodeParseRequest {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Raw file content.
     */
    readonly content: string
}

/**
 * Outbound contract for language-specific source-code parsers.
 */
export interface ISourceCodeParser {
    /**
     * Fine-grained language supported by parser instance.
     */
    readonly language: SupportedLanguage

    /**
     * Parses one source file into deterministic AST DTOs.
     *
     * @param request Parse request payload.
     * @returns Parsed source-file snapshot.
     */
    parse(request: ISourceCodeParseRequest): Promise<IParsedSourceFileDTO>
}
