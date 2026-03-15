import {
    AST_LANGUAGE,
    FilePath,
    type SupportedLanguage,
} from "@codenautic/core"

import {
    AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE,
    AstCyclomaticComplexityError,
} from "./ast-cyclomatic-complexity.error"

const BLOCK_COMMENT_START = "/*"
const BLOCK_COMMENT_END = "*/"
const TRIPLE_DOUBLE_QUOTE = "\"\"\""
const TRIPLE_SINGLE_QUOTE = "'''"

const COMMON_DECISION_KEYWORDS = ["if", "for", "while", "case", "catch"] as const
const PYTHON_DECISION_KEYWORDS = ["elif", "except"] as const
const RUBY_DECISION_KEYWORDS = ["elsif", "rescue", "when"] as const
const KOTLIN_DECISION_KEYWORDS = ["when"] as const

const SUPPORTED_AST_LANGUAGES: ReadonlySet<SupportedLanguage> = new Set<SupportedLanguage>([
    AST_LANGUAGE.TYPESCRIPT,
    AST_LANGUAGE.TSX,
    AST_LANGUAGE.JAVASCRIPT,
    AST_LANGUAGE.JSX,
    AST_LANGUAGE.PYTHON,
    AST_LANGUAGE.GO,
    AST_LANGUAGE.JAVA,
    AST_LANGUAGE.CSHARP,
    AST_LANGUAGE.RUBY,
    AST_LANGUAGE.RUST,
    AST_LANGUAGE.PHP,
    AST_LANGUAGE.KOTLIN,
])

interface IAstCyclomaticLanguageRules {
    readonly lineCommentMarkers: readonly string[]
    readonly supportsBlockComments: boolean
    readonly supportsPythonDocstringComments: boolean
    readonly supportsBacktickStrings: boolean
}

interface IAstCyclomaticScannerState {
    inBlockComment: boolean
    inStringDelimiter: "\"" | "'" | "`" | undefined
    inPythonDocstringDelimiter: typeof TRIPLE_DOUBLE_QUOTE | typeof TRIPLE_SINGLE_QUOTE | undefined
}

interface INormalizedAstCyclomaticComplexityFileInput {
    readonly filePath: string
    readonly language: SupportedLanguage
    readonly sourceCode: string
}

interface INormalizedAstCyclomaticComplexityInput {
    readonly files: readonly INormalizedAstCyclomaticComplexityFileInput[]
    readonly filePathFilter: ReadonlySet<string> | undefined
}

interface IScannedSourceLine {
    readonly sanitizedLine: string
    readonly hasCode: boolean
}

interface IScannedSourceCode {
    readonly sanitizedCode: string
    readonly hasCode: boolean
}

/**
 * One file cyclomatic complexity calculator input payload.
 */
export interface IAstCyclomaticComplexityFileInput {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Parsed language for source file.
     */
    readonly language: SupportedLanguage

    /**
     * Full source code text.
     */
    readonly sourceCode: string
}

/**
 * Input payload for AST cyclomatic complexity calculator.
 */
export interface IAstCyclomaticComplexityInput {
    /**
     * Source files used for complexity calculation.
     */
    readonly files: readonly IAstCyclomaticComplexityFileInput[]

    /**
     * Optional subset of file paths to process.
     */
    readonly filePaths?: readonly string[]
}

/**
 * One cyclomatic complexity item payload.
 */
export interface IAstCyclomaticComplexityItem {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * McCabe cyclomatic complexity score.
     */
    readonly complexity: number
}

/**
 * Summary payload for one complexity calculation run.
 */
export interface IAstCyclomaticComplexitySummary {
    /**
     * Total files provided in input.
     */
    readonly totalFiles: number

    /**
     * Number of files processed after optional file-path filtering.
     */
    readonly processedFiles: number

    /**
     * Total complexity across processed files.
     */
    readonly totalComplexity: number

    /**
     * Maximum complexity among processed files.
     */
    readonly maxComplexity: number
}

/**
 * Output payload for AST cyclomatic complexity calculation.
 */
export interface IAstCyclomaticComplexityResult {
    /**
     * Deterministic complexity result items.
     */
    readonly items: readonly IAstCyclomaticComplexityItem[]

    /**
     * Aggregated complexity summary.
     */
    readonly summary: IAstCyclomaticComplexitySummary
}

/**
 * AST cyclomatic complexity calculator contract.
 */
export interface IAstCyclomaticComplexityService {
    /**
     * Calculates cyclomatic complexity for source files with language-aware filtering.
     *
     * @param input Cyclomatic complexity input payload.
     * @returns Deterministic complexity result.
     */
    calculate(input: IAstCyclomaticComplexityInput): Promise<IAstCyclomaticComplexityResult>
}

/**
 * Calculates cyclomatic complexity per file using language-aware source scanning.
 */
export class AstCyclomaticComplexityService implements IAstCyclomaticComplexityService {
    /**
     * Calculates deterministic cyclomatic complexity result for provided source files.
     *
     * @param input Cyclomatic complexity input payload.
     * @returns Deterministic complexity result.
     */
    public calculate(input: IAstCyclomaticComplexityInput): Promise<IAstCyclomaticComplexityResult> {
        const normalizedInput = normalizeInput(input)
        const selectedFiles = selectFiles(normalizedInput.files, normalizedInput.filePathFilter)
        const items = selectedFiles
            .map((file): IAstCyclomaticComplexityItem => ({
                filePath: file.filePath,
                complexity: calculateFileComplexity(file),
            }))
            .sort((left, right) => left.filePath.localeCompare(right.filePath))

        const totalComplexity = items.reduce((sum, item) => sum + item.complexity, 0)
        const maxComplexity = items.reduce((max, item) => Math.max(max, item.complexity), 0)

        return Promise.resolve({
            items,
            summary: {
                totalFiles: normalizedInput.files.length,
                processedFiles: items.length,
                totalComplexity,
                maxComplexity,
            },
        })
    }
}

/**
 * Normalizes and validates complexity calculator input.
 *
 * @param input Raw complexity calculation input.
 * @returns Normalized input payload.
 */
function normalizeInput(input: IAstCyclomaticComplexityInput): INormalizedAstCyclomaticComplexityInput {
    const files = normalizeFiles(input.files)
    const filePathFilter = normalizeFilePathFilter(input.filePaths)

    return {
        files,
        filePathFilter,
    }
}

/**
 * Normalizes and validates source files list.
 *
 * @param files Raw file input list.
 * @returns Sorted normalized file list.
 */
function normalizeFiles(
    files: readonly IAstCyclomaticComplexityFileInput[],
): readonly INormalizedAstCyclomaticComplexityFileInput[] {
    if (files.length === 0) {
        throw new AstCyclomaticComplexityError(AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.EMPTY_FILES)
    }

    const fileByPath = new Map<string, INormalizedAstCyclomaticComplexityFileInput>()

    for (const file of files) {
        const filePath = normalizeFilePath(file.filePath)
        if (fileByPath.has(filePath)) {
            throw new AstCyclomaticComplexityError(
                AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath},
            )
        }

        fileByPath.set(filePath, {
            filePath,
            language: normalizeLanguage(file.language),
            sourceCode: normalizeSourceCode(file.sourceCode, filePath),
        })
    }

    return [...fileByPath.values()].sort((left, right) => left.filePath.localeCompare(right.filePath))
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw file-path filter.
 * @returns Normalized file-path filter set.
 */
function normalizeFilePathFilter(filePaths: readonly string[] | undefined): ReadonlySet<string> | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstCyclomaticComplexityError(
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.EMPTY_FILE_PATH_FILTER,
        )
    }

    const normalized = filePaths.map((filePath) => normalizeFilePath(filePath))
    return new Set<string>(normalized)
}

/**
 * Normalizes repository-relative file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstCyclomaticComplexityError(
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Normalizes and validates source language.
 *
 * @param language Raw source language.
 * @returns Validated source language.
 */
function normalizeLanguage(language: SupportedLanguage): SupportedLanguage {
    if (SUPPORTED_AST_LANGUAGES.has(language)) {
        return language
    }

    throw new AstCyclomaticComplexityError(
        AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.INVALID_LANGUAGE,
        {language},
    )
}

/**
 * Normalizes and validates source code input.
 *
 * @param sourceCode Raw source code.
 * @param filePath Repository-relative file path.
 * @returns Normalized source code.
 */
function normalizeSourceCode(sourceCode: string, filePath: string): string {
    if (typeof sourceCode !== "string") {
        throw new AstCyclomaticComplexityError(
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.INVALID_SOURCE_CODE,
            {filePath},
        )
    }

    return sourceCode
}

/**
 * Selects files for processing based on optional file-path filter.
 *
 * @param files Normalized file list.
 * @param filePathFilter Optional file-path filter.
 * @returns Selected file list.
 */
function selectFiles(
    files: readonly INormalizedAstCyclomaticComplexityFileInput[],
    filePathFilter: ReadonlySet<string> | undefined,
): readonly INormalizedAstCyclomaticComplexityFileInput[] {
    if (filePathFilter === undefined) {
        return files
    }

    return files.filter((file) => filePathFilter.has(file.filePath))
}

/**
 * Calculates cyclomatic complexity for one file.
 *
 * @param file Normalized file input.
 * @returns Cyclomatic complexity score.
 */
function calculateFileComplexity(file: INormalizedAstCyclomaticComplexityFileInput): number {
    const scanned = scanSourceCode(file)
    if (scanned.hasCode === false) {
        return 0
    }

    let complexity = 1
    complexity += countDecisionKeywords(scanned.sanitizedCode, file.language)
    complexity += countLogicalOperators(scanned.sanitizedCode, file.language)

    return complexity
}

/**
 * Scans source code to remove comments and string literals.
 *
 * @param file Normalized file input.
 * @returns Scanned source payload.
 */
function scanSourceCode(file: INormalizedAstCyclomaticComplexityFileInput): IScannedSourceCode {
    const rules = resolveLanguageRules(file.language)
    const state: IAstCyclomaticScannerState = {
        inBlockComment: false,
        inStringDelimiter: undefined,
        inPythonDocstringDelimiter: undefined,
    }

    const lines = normalizeSourceCodeLines(file.sourceCode)
    let hasCode = false
    const sanitizedLines: string[] = []

    for (const line of lines) {
        const scannedLine = scanSourceLine(line, state, rules)
        sanitizedLines.push(scannedLine.sanitizedLine)
        hasCode = hasCode || scannedLine.hasCode
    }

    return {
        sanitizedCode: sanitizedLines.join("\n"),
        hasCode,
    }
}

/**
 * Resolves line-comment and block-comment behavior for one language.
 *
 * @param language File language.
 * @returns Language rules for source scanner.
 */
function resolveLanguageRules(language: SupportedLanguage): IAstCyclomaticLanguageRules {
    if (language === AST_LANGUAGE.PYTHON) {
        return {
            lineCommentMarkers: ["#"],
            supportsBlockComments: false,
            supportsPythonDocstringComments: true,
            supportsBacktickStrings: false,
        }
    }

    if (language === AST_LANGUAGE.RUBY) {
        return {
            lineCommentMarkers: ["#"],
            supportsBlockComments: false,
            supportsPythonDocstringComments: false,
            supportsBacktickStrings: true,
        }
    }

    if (language === AST_LANGUAGE.PHP) {
        return {
            lineCommentMarkers: ["//", "#"],
            supportsBlockComments: true,
            supportsPythonDocstringComments: false,
            supportsBacktickStrings: false,
        }
    }

    return {
        lineCommentMarkers: ["//"],
        supportsBlockComments: true,
        supportsPythonDocstringComments: false,
        supportsBacktickStrings: true,
    }
}

/**
 * Normalizes source code into deterministic LF-only lines.
 *
 * @param sourceCode Source code payload.
 * @returns Source lines.
 */
function normalizeSourceCodeLines(sourceCode: string): readonly string[] {
    const normalized = sourceCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    return normalized.split("\n")
}

/**
 * Scans one source line and removes comments and string literals.
 *
 * @param line Source line text.
 * @param state Mutable scanner state.
 * @param rules Language comment and string rules.
 * @returns Sanitized line and code-presence flag.
 */
function scanSourceLine(
    line: string,
    state: IAstCyclomaticScannerState,
    rules: IAstCyclomaticLanguageRules,
): IScannedSourceLine {
    let index = 0
    let hasCode = false
    let sanitizedLine = ""

    while (index < line.length) {
        if (state.inPythonDocstringDelimiter !== undefined) {
            index = consumePythonDocstring(line, index, state)
            sanitizedLine += " "
            continue
        }

        if (state.inBlockComment) {
            index = consumeBlockComment(line, index, state)
            sanitizedLine += " "
            continue
        }

        if (state.inStringDelimiter !== undefined) {
            hasCode = true
            index = consumeStringLiteral(line, index, state.inStringDelimiter, state)
            sanitizedLine += " "
            continue
        }

        const current = line.charAt(index)
        if (isWhitespaceChar(current)) {
            sanitizedLine += current
            index += 1
            continue
        }

        const docstringDelimiter = resolvePythonDocstringStart(line, index, rules)
        if (docstringDelimiter !== undefined) {
            state.inPythonDocstringDelimiter = docstringDelimiter
            sanitizedLine += " "
            index += 3
            continue
        }

        if (hasLineCommentStart(line, index, rules.lineCommentMarkers)) {
            sanitizedLine += " "
            break
        }

        if (hasBlockCommentStart(line, index, rules.supportsBlockComments)) {
            state.inBlockComment = true
            sanitizedLine += " "
            index += BLOCK_COMMENT_START.length
            continue
        }

        if (isStringDelimiter(current, rules.supportsBacktickStrings)) {
            hasCode = true
            state.inStringDelimiter = current
            sanitizedLine += " "
            index += 1
            continue
        }

        hasCode = true
        sanitizedLine += current
        index += 1
    }

    return {
        sanitizedLine,
        hasCode,
    }
}

/**
 * Counts decision keywords for one language.
 *
 * @param sanitizedCode Source code without comments and strings.
 * @param language File language.
 * @returns Decision keyword count.
 */
function countDecisionKeywords(sanitizedCode: string, language: SupportedLanguage): number {
    const lowerCaseSource = sanitizedCode.toLowerCase()
    const keywords = resolveDecisionKeywords(language)

    return keywords.reduce((sum, keyword) => sum + countWordOccurrences(lowerCaseSource, keyword), 0)
}

/**
 * Resolves language-specific control-flow keywords.
 *
 * @param language File language.
 * @returns Decision keyword list.
 */
function resolveDecisionKeywords(language: SupportedLanguage): readonly string[] {
    if (language === AST_LANGUAGE.PYTHON) {
        return [...COMMON_DECISION_KEYWORDS, ...PYTHON_DECISION_KEYWORDS]
    }

    if (language === AST_LANGUAGE.RUBY) {
        return [...COMMON_DECISION_KEYWORDS, ...RUBY_DECISION_KEYWORDS]
    }

    if (language === AST_LANGUAGE.KOTLIN) {
        return [...COMMON_DECISION_KEYWORDS, ...KOTLIN_DECISION_KEYWORDS]
    }

    return [...COMMON_DECISION_KEYWORDS]
}

/**
 * Counts logical operators used as additional control-flow split points.
 *
 * @param sanitizedCode Source code without comments and strings.
 * @param language File language.
 * @returns Logical-operator decision count.
 */
function countLogicalOperators(sanitizedCode: string, language: SupportedLanguage): number {
    const lowerCaseSource = sanitizedCode.toLowerCase()
    const symbolCount =
        countSymbolOccurrences(lowerCaseSource, "&&")
        + countSymbolOccurrences(lowerCaseSource, "||")

    if (language === AST_LANGUAGE.PYTHON) {
        return symbolCount
            + countWordOccurrences(lowerCaseSource, "and")
            + countWordOccurrences(lowerCaseSource, "or")
    }

    if (language === AST_LANGUAGE.RUBY) {
        return symbolCount
            + countWordOccurrences(lowerCaseSource, "and")
            + countWordOccurrences(lowerCaseSource, "or")
    }

    return symbolCount
}

/**
 * Counts one whole-word keyword occurrence.
 *
 * @param source Lowercased source payload.
 * @param keyword Lowercased keyword.
 * @returns Whole-word occurrence count.
 */
function countWordOccurrences(source: string, keyword: string): number {
    const pattern = new RegExp(`\\b${escapeRegularExpression(keyword)}\\b`, "g")
    return countRegularExpressionMatches(source, pattern)
}

/**
 * Counts one symbol occurrence.
 *
 * @param source Lowercased source payload.
 * @param symbol Symbol fragment.
 * @returns Symbol occurrence count.
 */
function countSymbolOccurrences(source: string, symbol: string): number {
    const pattern = new RegExp(escapeRegularExpression(symbol), "g")
    return countRegularExpressionMatches(source, pattern)
}

/**
 * Counts regular-expression matches.
 *
 * @param source Source payload.
 * @param pattern Global regular expression.
 * @returns Match count.
 */
function countRegularExpressionMatches(source: string, pattern: RegExp): number {
    const matches = source.match(pattern)
    return matches === null ? 0 : matches.length
}

/**
 * Escapes regular-expression syntax characters.
 *
 * @param value Raw string.
 * @returns Escaped string.
 */
function escapeRegularExpression(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Consumes block-comment content up to the next scanner cursor.
 *
 * @param line Source line text.
 * @param index Current scanner cursor.
 * @param state Mutable scanner state.
 * @returns Next scanner cursor.
 */
function consumeBlockComment(line: string, index: number, state: IAstCyclomaticScannerState): number {
    const blockCommentEndIndex = line.indexOf(BLOCK_COMMENT_END, index)
    if (blockCommentEndIndex === -1) {
        return line.length
    }

    state.inBlockComment = false
    return blockCommentEndIndex + BLOCK_COMMENT_END.length
}

/**
 * Consumes python triple-quote docstring content up to next scanner cursor.
 *
 * @param line Source line text.
 * @param index Current scanner cursor.
 * @param state Mutable scanner state.
 * @returns Next scanner cursor.
 */
function consumePythonDocstring(
    line: string,
    index: number,
    state: IAstCyclomaticScannerState,
): number {
    const delimiter = state.inPythonDocstringDelimiter
    if (delimiter === undefined) {
        return index
    }

    const docstringEndIndex = line.indexOf(delimiter, index)
    if (docstringEndIndex === -1) {
        return line.length
    }

    state.inPythonDocstringDelimiter = undefined
    return docstringEndIndex + delimiter.length
}

/**
 * Consumes string literal content up to next scanner cursor.
 *
 * @param line Source line text.
 * @param index Current scanner cursor.
 * @param delimiter Current string delimiter.
 * @param state Mutable scanner state.
 * @returns Next scanner cursor.
 */
function consumeStringLiteral(
    line: string,
    index: number,
    delimiter: "\"" | "'" | "`",
    state: IAstCyclomaticScannerState,
): number {
    let cursor = index

    while (cursor < line.length) {
        const current = line.charAt(cursor)

        if (current === "\\") {
            cursor += 2
            continue
        }

        if (current === delimiter) {
            state.inStringDelimiter = undefined
            return cursor + 1
        }

        cursor += 1
    }

    return line.length
}

/**
 * Resolves python triple-quote docstring start delimiter when present.
 *
 * @param line Source line text.
 * @param index Current scanner cursor.
 * @param rules Language rules.
 * @returns Triple-quote delimiter when present.
 */
function resolvePythonDocstringStart(
    line: string,
    index: number,
    rules: IAstCyclomaticLanguageRules,
): typeof TRIPLE_DOUBLE_QUOTE | typeof TRIPLE_SINGLE_QUOTE | undefined {
    if (rules.supportsPythonDocstringComments === false) {
        return undefined
    }

    if (line.startsWith(TRIPLE_DOUBLE_QUOTE, index)) {
        return TRIPLE_DOUBLE_QUOTE
    }

    if (line.startsWith(TRIPLE_SINGLE_QUOTE, index)) {
        return TRIPLE_SINGLE_QUOTE
    }

    return undefined
}

/**
 * Resolves whether scanner cursor starts one line comment.
 *
 * @param line Source line text.
 * @param index Current scanner cursor.
 * @param lineCommentMarkers Language line-comment markers.
 * @returns `true` when line comment starts at cursor.
 */
function hasLineCommentStart(
    line: string,
    index: number,
    lineCommentMarkers: readonly string[],
): boolean {
    return lineCommentMarkers.some((marker) => line.startsWith(marker, index))
}

/**
 * Resolves whether scanner cursor starts one block comment.
 *
 * @param line Source line text.
 * @param index Current scanner cursor.
 * @param supportsBlockComments Language flag.
 * @returns `true` when block comment starts at cursor.
 */
function hasBlockCommentStart(line: string, index: number, supportsBlockComments: boolean): boolean {
    if (supportsBlockComments === false) {
        return false
    }

    return line.startsWith(BLOCK_COMMENT_START, index)
}

/**
 * Resolves whether char is one supported string delimiter.
 *
 * @param value Current character.
 * @param supportsBacktickStrings Language flag.
 * @returns `true` when char starts one string literal.
 */
function isStringDelimiter(value: string, supportsBacktickStrings: boolean): value is "\"" | "'" | "`" {
    if (value === "\"" || value === "'") {
        return true
    }

    if (supportsBacktickStrings && value === "`") {
        return true
    }

    return false
}

/**
 * Resolves whether char is one whitespace symbol.
 *
 * @param value Current character.
 * @returns `true` when char is whitespace.
 */
function isWhitespaceChar(value: string): boolean {
    return value === " " || value === "\t" || value === "\n" || value === "\r" || value === "\f"
}
