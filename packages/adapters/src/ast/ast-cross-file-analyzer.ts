import {posix as pathPosix} from "node:path"

import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_CROSS_FILE_ANALYZER_ERROR_CODE,
    AstCrossFileAnalyzerError,
} from "./ast-cross-file-analyzer.error"

/**
 * Runtime input shared by cross-file analyzers.
 */
export interface IAstCrossFileAnalyzerInput {
    /**
     * Optional subset of source file paths for batch analysis.
     */
    readonly filePaths?: readonly string[]
}

/**
 * Normalized parsed source file for cross-file analysis.
 */
export interface IAstCrossFileAnalyzerFile {
    /**
     * Normalized repository-relative file path.
     */
    readonly filePath: string

    /**
     * Normalized parent directory path.
     */
    readonly directoryPath: string

    /**
     * Original parsed source file payload.
     */
    readonly parsedFile: IParsedSourceFileDTO
}

/**
 * Deterministic analysis context prepared by base cross-file analyzer.
 */
export interface IAstCrossFileAnalysisContext {
    /**
     * Sorted normalized files participating in one analysis run.
     */
    readonly files: readonly IAstCrossFileAnalyzerFile[]

    /**
     * Sorted normalized source files selected for analysis.
     */
    readonly sourceFiles: readonly IAstCrossFileAnalyzerFile[]

    /**
     * Lookup for all normalized files by path.
     */
    readonly fileLookup: ReadonlyMap<string, IAstCrossFileAnalyzerFile>

    /**
     * Lookup for selected source files by path.
     */
    readonly sourceFileLookup: ReadonlyMap<string, IAstCrossFileAnalyzerFile>
}

/**
 * Generic base class for deterministic cross-file analysis services.
 */
export abstract class AstCrossFileAnalyzer<
    TInput extends IAstCrossFileAnalyzerInput,
    TOutput,
> {
    /**
     * Executes cross-file analysis with normalized deterministic context.
     *
     * @param files Parsed source files.
     * @param input Runtime input for one analysis run.
     * @returns Analysis output.
     */
    public analyze(
        files: readonly IParsedSourceFileDTO[],
        input: TInput,
    ): Promise<TOutput> {
        const context = createCrossFileAnalysisContext(files, input)
        return Promise.resolve(this.analyzeWithContext(context, input))
    }

    /**
     * Performs domain-specific cross-file analysis on prepared context.
     *
     * @param context Prepared deterministic analysis context.
     * @param input Runtime input for one analysis run.
     * @returns Analysis output.
     */
    protected abstract analyzeWithContext(
        context: IAstCrossFileAnalysisContext,
        input: TInput,
    ): Promise<TOutput> | TOutput
}

/**
 * Creates deterministic context from parsed files and optional source filter.
 *
 * @param files Parsed source files.
 * @param input Runtime input.
 * @returns Prepared deterministic context.
 */
function createCrossFileAnalysisContext(
    files: readonly IParsedSourceFileDTO[],
    input: IAstCrossFileAnalyzerInput,
): IAstCrossFileAnalysisContext {
    const normalizedFiles = normalizeParsedFiles(files)
    const sourceFilePaths = normalizeFilePathFilter(input.filePaths)
    const sourceFiles = filterSourceFiles(normalizedFiles, sourceFilePaths)

    return {
        files: normalizedFiles,
        sourceFiles,
        fileLookup: createFileLookup(normalizedFiles),
        sourceFileLookup: createFileLookup(sourceFiles),
    }
}

/**
 * Normalizes parsed-file input and validates duplicate paths.
 *
 * @param files Parsed source files.
 * @returns Sorted normalized files.
 */
function normalizeParsedFiles(
    files: readonly IParsedSourceFileDTO[],
): readonly IAstCrossFileAnalyzerFile[] {
    if (files.length === 0) {
        throw new AstCrossFileAnalyzerError(AST_CROSS_FILE_ANALYZER_ERROR_CODE.EMPTY_FILES)
    }

    const seenPaths = new Set<string>()
    const normalizedFiles: IAstCrossFileAnalyzerFile[] = []

    for (const file of files) {
        const filePath = normalizeFilePath(file.filePath)

        if (seenPaths.has(filePath)) {
            throw new AstCrossFileAnalyzerError(
                AST_CROSS_FILE_ANALYZER_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath},
            )
        }

        seenPaths.add(filePath)
        normalizedFiles.push({
            filePath,
            directoryPath: pathPosix.dirname(filePath),
            parsedFile: file,
        })
    }

    return normalizedFiles.sort((left, right) => left.filePath.localeCompare(right.filePath))
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw filter paths.
 * @returns Sorted unique normalized paths or undefined.
 */
function normalizeFilePathFilter(
    filePaths?: readonly string[],
): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstCrossFileAnalyzerError(
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedPaths = new Set<string>()

    for (const filePath of filePaths) {
        normalizedPaths.add(normalizeFilePath(filePath))
    }

    return [...normalizedPaths].sort()
}

/**
 * Applies optional source-file batch filter.
 *
 * @param files Normalized files.
 * @param filePaths Optional source-file filter.
 * @returns Filtered source files.
 */
function filterSourceFiles(
    files: readonly IAstCrossFileAnalyzerFile[],
    filePaths?: readonly string[],
): readonly IAstCrossFileAnalyzerFile[] {
    if (filePaths === undefined) {
        return files
    }

    const pathSet = new Set<string>(filePaths)
    return files.filter((file) => pathSet.has(file.filePath))
}

/**
 * Creates lookup for normalized files by path.
 *
 * @param files Normalized files.
 * @returns File lookup.
 */
function createFileLookup(
    files: readonly IAstCrossFileAnalyzerFile[],
): ReadonlyMap<string, IAstCrossFileAnalyzerFile> {
    const entries = files.map((file): readonly [string, IAstCrossFileAnalyzerFile] => {
        return [file.filePath, file]
    })

    return new Map<string, IAstCrossFileAnalyzerFile>(entries)
}

/**
 * Normalizes one repository-relative file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstCrossFileAnalyzerError(
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}
