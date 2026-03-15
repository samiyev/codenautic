import {FilePath, type IAstFunctionDTO} from "@codenautic/core"

import {
    AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE,
    AstFunctionBodyExtractorError,
} from "./ast-function-body-extractor.error"

/**
 * Input payload for function body extraction.
 */
export interface IAstFunctionBodyExtractorInput {
    /**
     * Repository-relative file path for source code snapshot.
     */
    readonly filePath: string

    /**
     * Full source code text.
     */
    readonly sourceCode: string

    /**
     * Parsed function declarations for source file.
     */
    readonly functions: readonly IAstFunctionDTO[]
}

/**
 * One extracted function body payload.
 */
export interface IAstExtractedFunctionBody {
    /**
     * Stable deterministic function reference identifier.
     */
    readonly id: string

    /**
     * Repository-relative file path for extracted function.
     */
    readonly filePath: string

    /**
     * Function or method name.
     */
    readonly functionName: string

    /**
     * Optional class name for methods.
     */
    readonly parentClassName?: string

    /**
     * 1-based source-code start line.
     */
    readonly lineStart: number

    /**
     * 1-based source-code end line.
     */
    readonly lineEnd: number

    /**
     * Total number of lines in extracted body.
     */
    readonly lineCount: number

    /**
     * Exact source-code text between lineStart and lineEnd.
     */
    readonly fullText: string
}

/**
 * Aggregated summary for one extraction run.
 */
export interface IAstFunctionBodyExtractorSummary {
    /**
     * Number of function declarations processed.
     */
    readonly functionCount: number

    /**
     * Number of extracted function bodies.
     */
    readonly extractedCount: number

    /**
     * Maximum extracted body size by line count.
     */
    readonly longestBodyLineCount: number
}

/**
 * Output payload for function body extraction.
 */
export interface IAstFunctionBodyExtractorResult {
    /**
     * Deterministic extracted function bodies.
     */
    readonly bodies: readonly IAstExtractedFunctionBody[]

    /**
     * Aggregated extraction summary.
     */
    readonly summary: IAstFunctionBodyExtractorSummary
}

/**
 * Function body extractor contract.
 */
export interface IAstFunctionBodyExtractorService {
    /**
     * Extracts deterministic function bodies from source-code line ranges.
     *
     * @param input Function body extraction input.
     * @returns Extracted function body payload.
     */
    extract(input: IAstFunctionBodyExtractorInput): Promise<IAstFunctionBodyExtractorResult>
}

interface INormalizedFunctionBodyExtractorInput {
    readonly filePath: string
    readonly sourceLines: readonly string[]
    readonly functions: readonly IAstFunctionDTO[]
}

/**
 * Extracts function full text by parsed source-code line ranges.
 */
export class AstFunctionBodyExtractorService implements IAstFunctionBodyExtractorService {
    /**
     * Extracts deterministic function bodies from parsed function declarations.
     *
     * @param input Function body extraction input.
     * @returns Deterministic extracted function bodies.
     */
    public extract(input: IAstFunctionBodyExtractorInput): Promise<IAstFunctionBodyExtractorResult> {
        const normalizedInput = normalizeInput(input)
        const bodies = extractFunctionBodies(normalizedInput)

        return Promise.resolve({
            bodies,
            summary: createSummary(normalizedInput.functions.length, bodies),
        })
    }
}

/**
 * Normalizes extraction input and validates required constraints.
 *
 * @param input Raw extraction input.
 * @returns Normalized extraction input.
 */
function normalizeInput(input: IAstFunctionBodyExtractorInput): INormalizedFunctionBodyExtractorInput {
    const filePath = normalizeFilePath(input.filePath)
    const sourceLines = splitSourceCode(input.sourceCode)
    const functions = normalizeFunctions(input.functions)

    return {
        filePath,
        sourceLines,
        functions,
    }
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
        throw new AstFunctionBodyExtractorError(
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Splits source code into deterministic normalized line array.
 *
 * @param sourceCode Raw source code text.
 * @returns Source-code lines.
 */
function splitSourceCode(sourceCode: string): readonly string[] {
    if (sourceCode.length === 0) {
        throw new AstFunctionBodyExtractorError(
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_SOURCE_CODE,
        )
    }

    const normalizedSourceCode = sourceCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    return normalizedSourceCode.split("\n")
}

/**
 * Normalizes function declarations and validates non-empty payload.
 *
 * @param functions Parsed function declarations.
 * @returns Sorted function declarations.
 */
function normalizeFunctions(functions: readonly IAstFunctionDTO[]): readonly IAstFunctionDTO[] {
    if (functions.length === 0) {
        throw new AstFunctionBodyExtractorError(
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.EMPTY_FUNCTIONS,
        )
    }

    return [...functions].sort(compareFunctions)
}

/**
 * Extracts function bodies for all declarations from normalized input.
 *
 * @param input Normalized extraction input.
 * @returns Deterministic extracted function bodies.
 */
function extractFunctionBodies(
    input: INormalizedFunctionBodyExtractorInput,
): readonly IAstExtractedFunctionBody[] {
    const bodies: IAstExtractedFunctionBody[] = []
    const seenIds = new Set<string>()

    for (const fn of input.functions) {
        const functionName = normalizeFunctionName(fn.name)
        const lineStart = fn.location.lineStart
        const lineEnd = fn.location.lineEnd
        validateFunctionRange(lineStart, lineEnd, input.sourceLines.length)

        const bodyId = createFunctionBodyId(
            input.filePath,
            functionName,
            fn.parentClassName,
            lineStart,
            lineEnd,
        )
        if (seenIds.has(bodyId)) {
            throw new AstFunctionBodyExtractorError(
                AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.DUPLICATE_FUNCTION_REFERENCE,
                {functionId: bodyId},
            )
        }

        seenIds.add(bodyId)
        bodies.push({
            id: bodyId,
            filePath: input.filePath,
            functionName,
            ...(fn.parentClassName !== undefined ? {parentClassName: fn.parentClassName} : {}),
            lineStart,
            lineEnd,
            lineCount: lineEnd - lineStart + 1,
            fullText: input.sourceLines.slice(lineStart - 1, lineEnd).join("\n"),
        })
    }

    return bodies
}

/**
 * Normalizes one function name.
 *
 * @param functionName Raw function name.
 * @returns Normalized function name.
 */
function normalizeFunctionName(functionName: string): string {
    const normalizedFunctionName = functionName.trim()
    if (normalizedFunctionName.length === 0) {
        throw new AstFunctionBodyExtractorError(
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_FUNCTION_NAME,
            {functionName},
        )
    }

    return normalizedFunctionName
}

/**
 * Validates one function line range against source-code line count.
 *
 * @param lineStart Function start line.
 * @param lineEnd Function end line.
 * @param totalLineCount Source-code total line count.
 */
function validateFunctionRange(lineStart: number, lineEnd: number, totalLineCount: number): void {
    const hasValidStart = Number.isSafeInteger(lineStart) && lineStart >= 1
    const hasValidEnd = Number.isSafeInteger(lineEnd) && lineEnd >= lineStart
    const inBounds = lineEnd <= totalLineCount

    if (hasValidStart && hasValidEnd && inBounds) {
        return
    }

    throw new AstFunctionBodyExtractorError(
        AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_FUNCTION_RANGE,
        {
            lineStart,
            lineEnd,
        },
    )
}

/**
 * Creates stable function body identifier.
 *
 * @param filePath Normalized file path.
 * @param functionName Normalized function name.
 * @param parentClassName Optional parent class name.
 * @param lineStart Function start line.
 * @param lineEnd Function end line.
 * @returns Stable function body identifier.
 */
function createFunctionBodyId(
    filePath: string,
    functionName: string,
    parentClassName: string | undefined,
    lineStart: number,
    lineEnd: number,
): string {
    const qualifiedName =
        parentClassName !== undefined ? `${parentClassName.trim()}.${functionName}` : functionName

    return `${filePath}:${qualifiedName}:${lineStart}:${lineEnd}`
}

/**
 * Compares function declarations deterministically.
 *
 * @param left Left function declaration.
 * @param right Right function declaration.
 * @returns Sort result.
 */
function compareFunctions(left: IAstFunctionDTO, right: IAstFunctionDTO): number {
    const startCompare = left.location.lineStart - right.location.lineStart
    if (startCompare !== 0) {
        return startCompare
    }

    const endCompare = left.location.lineEnd - right.location.lineEnd
    if (endCompare !== 0) {
        return endCompare
    }

    const nameCompare = left.name.localeCompare(right.name)
    if (nameCompare !== 0) {
        return nameCompare
    }

    const leftParentClass = left.parentClassName ?? ""
    const rightParentClass = right.parentClassName ?? ""
    return leftParentClass.localeCompare(rightParentClass)
}

/**
 * Creates aggregated summary for extraction run.
 *
 * @param functionCount Number of parsed functions.
 * @param bodies Extracted function bodies.
 * @returns Aggregated summary.
 */
function createSummary(
    functionCount: number,
    bodies: readonly IAstExtractedFunctionBody[],
): IAstFunctionBodyExtractorSummary {
    let longestBodyLineCount = 0

    for (const body of bodies) {
        if (body.lineCount > longestBodyLineCount) {
            longestBodyLineCount = body.lineCount
        }
    }

    return {
        functionCount,
        extractedCount: bodies.length,
        longestBodyLineCount,
    }
}
