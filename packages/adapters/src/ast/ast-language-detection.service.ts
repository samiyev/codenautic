import {AST_LANGUAGE, FilePath, type SupportedLanguage} from "@codenautic/core"

import {
    AST_LANGUAGE_DETECTION_ERROR_CODE,
    AstLanguageDetectionError,
} from "./ast-language-detection.error"

const EXACT_FILE_NAME_LANGUAGE: Readonly<Record<string, SupportedLanguage>> = {
    gemfile: AST_LANGUAGE.RUBY,
    rakefile: AST_LANGUAGE.RUBY,
    podfile: AST_LANGUAGE.RUBY,
    fastfile: AST_LANGUAGE.RUBY,
    appraisals: AST_LANGUAGE.RUBY,
    brewfile: AST_LANGUAGE.RUBY,
    dangerfile: AST_LANGUAGE.RUBY,
}

const EXTENSION_LANGUAGE: Readonly<Record<string, SupportedLanguage>> = {
    ".ts": AST_LANGUAGE.TYPESCRIPT,
    ".tsx": AST_LANGUAGE.TSX,
    ".mts": AST_LANGUAGE.TYPESCRIPT,
    ".cts": AST_LANGUAGE.TYPESCRIPT,
    ".js": AST_LANGUAGE.JAVASCRIPT,
    ".jsx": AST_LANGUAGE.JSX,
    ".mjs": AST_LANGUAGE.JAVASCRIPT,
    ".cjs": AST_LANGUAGE.JAVASCRIPT,
    ".py": AST_LANGUAGE.PYTHON,
    ".go": AST_LANGUAGE.GO,
    ".java": AST_LANGUAGE.JAVA,
    ".cs": AST_LANGUAGE.CSHARP,
    ".rb": AST_LANGUAGE.RUBY,
    ".rs": AST_LANGUAGE.RUST,
    ".php": AST_LANGUAGE.PHP,
    ".kt": AST_LANGUAGE.KOTLIN,
    ".kts": AST_LANGUAGE.KOTLIN,
}

type IScriptRuntimeFamily = "node" | "bun" | "deno" | "ts-node" | "tsx"

/**
 * Input payload for AST language detection.
 */
export interface IAstLanguageDetectionInput {
    /**
     * Repository-relative or absolute file path.
     */
    readonly filePath: string

    /**
     * Optional source content for shebang and tiebreaker analysis.
     */
    readonly content?: string
}

/**
 * Contract for AST language detection service.
 */
export interface IAstLanguageDetectionService {
    /**
     * Detects canonical AST language for one source file.
     *
     * @param input File path and optional source content.
     * @returns Canonical supported language.
     * @throws AstLanguageDetectionError when file path is invalid or language cannot be detected.
     */
    detect(input: IAstLanguageDetectionInput): SupportedLanguage
}

/**
 * Detects AST language using exact filenames, extensions, shebangs, and narrow content heuristics.
 */
export class AstLanguageDetectionService implements IAstLanguageDetectionService {
    /**
     * Detects canonical AST language for one source file.
     *
     * @param input File path and optional source content.
     * @returns Canonical supported language.
     * @throws AstLanguageDetectionError when file path is invalid or language cannot be detected.
     */
    public detect(input: IAstLanguageDetectionInput): SupportedLanguage {
        const filePath = this.normalizeFilePath(input.filePath)
        const fileName = filePath.fileName().toLowerCase()

        const exactFileNameLanguage = EXACT_FILE_NAME_LANGUAGE[fileName]
        if (exactFileNameLanguage !== undefined) {
            return exactFileNameLanguage
        }

        const extensionLanguage = detectByExtension(fileName, filePath.extension())
        if (extensionLanguage !== undefined) {
            return extensionLanguage
        }

        const firstLine = readFirstLine(input.content)
        const shebangLanguage = detectByShebang(firstLine, input.content)
        if (shebangLanguage !== undefined) {
            return shebangLanguage
        }

        throw new AstLanguageDetectionError(
            `Unable to detect AST language for file: ${filePath.toString()}`,
            {
                code: AST_LANGUAGE_DETECTION_ERROR_CODE.LANGUAGE_NOT_DETECTED,
                filePath: input.filePath,
            },
        )
    }

    /**
     * Normalizes file path and converts invalid input into typed detection error.
     *
     * @param filePath Raw file path input.
     * @returns Normalized file path value object.
     * @throws AstLanguageDetectionError when path is blank.
     */
    private normalizeFilePath(filePath: string): FilePath {
        try {
            return FilePath.create(filePath)
        } catch {
            throw new AstLanguageDetectionError("AST language file path cannot be empty", {
                code: AST_LANGUAGE_DETECTION_ERROR_CODE.INVALID_FILE_PATH,
                filePath,
            })
        }
    }
}

/**
 * Detects supported language by file extension and multi-suffix patterns.
 *
 * @param fileName Normalized lowercase file name.
 * @param extension Normalized trailing extension with leading dot.
 * @returns Canonical language or `undefined`.
 */
function detectByExtension(
    fileName: string,
    extension: string,
): SupportedLanguage | undefined {
    if (fileName.endsWith(".d.ts")) {
        return AST_LANGUAGE.TYPESCRIPT
    }

    const extensionLanguage = EXTENSION_LANGUAGE[extension.toLowerCase()]
    return extensionLanguage
}

/**
 * Extracts the first source line and strips UTF-8 BOM when present.
 *
 * @param content Optional source content.
 * @returns First line or `undefined`.
 */
function readFirstLine(content: string | undefined): string | undefined {
    if (content === undefined) {
        return undefined
    }

    const [firstLine = ""] = content.replace(/^\uFEFF/, "").split(/\r?\n/u, 1)
    const normalizedFirstLine = firstLine.trim()
    if (normalizedFirstLine.length === 0) {
        return undefined
    }

    return normalizedFirstLine
}

/**
 * Detects language from shebang and, for script runtimes, uses content heuristics to break ties.
 *
 * @param firstLine Optional first line of source content.
 * @param content Optional full content.
 * @returns Canonical language or `undefined`.
 */
function detectByShebang(
    firstLine: string | undefined,
    content: string | undefined,
): SupportedLanguage | undefined {
    if (firstLine === undefined || !firstLine.startsWith("#!")) {
        return undefined
    }

    const normalizedShebang = firstLine.toLowerCase()
    const explicitLanguage = detectNonScriptShebang(normalizedShebang)
    if (explicitLanguage !== undefined) {
        return explicitLanguage
    }

    const runtimeFamily = detectScriptRuntimeFamily(normalizedShebang)
    if (runtimeFamily === undefined) {
        return undefined
    }

    return detectScriptFamilyLanguage(runtimeFamily, content)
}

/**
 * Detects non-JavaScript-family languages from shebang line.
 *
 * @param shebang Normalized shebang line.
 * @returns Canonical language or `undefined`.
 */
function detectNonScriptShebang(shebang: string): SupportedLanguage | undefined {
    if (/\bpython[0-9.]*\b/u.test(shebang)) {
        return AST_LANGUAGE.PYTHON
    }

    if (/\bruby\b/u.test(shebang)) {
        return AST_LANGUAGE.RUBY
    }

    if (/\bphp\b/u.test(shebang)) {
        return AST_LANGUAGE.PHP
    }

    if (/\bjava\b/u.test(shebang)) {
        return AST_LANGUAGE.JAVA
    }

    if (/\bkotlin\b/u.test(shebang)) {
        return AST_LANGUAGE.KOTLIN
    }

    if (/\bgo\b/u.test(shebang)) {
        return AST_LANGUAGE.GO
    }

    return undefined
}

/**
 * Detects script runtime family that may still require content tiebreaking.
 *
 * @param shebang Normalized shebang line.
 * @returns Runtime family or `undefined`.
 */
function detectScriptRuntimeFamily(shebang: string): IScriptRuntimeFamily | undefined {
    if (/\bts-node\b/u.test(shebang)) {
        return "ts-node"
    }

    if (/\btsx\b/u.test(shebang)) {
        return "tsx"
    }

    if (/\bbun\b/u.test(shebang)) {
        return "bun"
    }

    if (/\bdeno\b/u.test(shebang)) {
        return "deno"
    }

    if (/\bnode\b/u.test(shebang)) {
        return "node"
    }

    return undefined
}

/**
 * Resolves JavaScript-family shebangs into canonical language using minimal content heuristics.
 *
 * @param runtimeFamily Script runtime family.
 * @param content Optional source content.
 * @returns Canonical language.
 */
function detectScriptFamilyLanguage(
    runtimeFamily: IScriptRuntimeFamily,
    content: string | undefined,
): SupportedLanguage {
    const normalizedContent = content ?? ""
    const hasTypeScriptSyntax = containsTypeScriptSyntax(normalizedContent)
    const hasJsxSyntax = containsJsxSyntax(normalizedContent)

    if (runtimeFamily === "ts-node" || runtimeFamily === "tsx") {
        if (hasJsxSyntax) {
            return AST_LANGUAGE.TSX
        }

        return AST_LANGUAGE.TYPESCRIPT
    }

    if (hasTypeScriptSyntax && hasJsxSyntax) {
        return AST_LANGUAGE.TSX
    }

    if (hasJsxSyntax) {
        return AST_LANGUAGE.JSX
    }

    if (hasTypeScriptSyntax && runtimeFamily !== "node") {
        return AST_LANGUAGE.TYPESCRIPT
    }

    return AST_LANGUAGE.JAVASCRIPT
}

/**
 * Detects clear TypeScript-only syntax markers in content.
 *
 * @param content Optional source content.
 * @returns True when TypeScript markers are present.
 */
function containsTypeScriptSyntax(content: string): boolean {
    const typeScriptPatterns = [
        /\binterface\s+[A-Za-z_$][\w$]*/u,
        /\btype\s+[A-Za-z_$][\w$]*\s*=/u,
        /\bimplements\s+[A-Za-z_$][\w$]*/u,
        /\b(enum|namespace)\s+[A-Za-z_$][\w$]*/u,
        /\b(public|private|protected|readonly|abstract)\s+/u,
        /:\s*(string|number|boolean|unknown|never|void|bigint|symbol)\b/u,
    ]

    for (const pattern of typeScriptPatterns) {
        if (pattern.test(content)) {
            return true
        }
    }

    return false
}

/**
 * Detects JSX-like syntax in content with conservative heuristics.
 *
 * @param content Optional source content.
 * @returns True when JSX markers are present.
 */
function containsJsxSyntax(content: string): boolean {
    const jsxPatterns = [
        /return\s*\(?\s*<[A-Za-z>]/u,
        /=>\s*<[A-Za-z>]/u,
        /=\s*<[A-Za-z>]/u,
        /<[A-Z][A-Za-z0-9]*(\s|\/?>)/u,
        /<\/[A-Za-z][A-Za-z0-9]*>/u,
    ]

    for (const pattern of jsxPatterns) {
        if (pattern.test(content)) {
            return true
        }
    }

    return false
}
