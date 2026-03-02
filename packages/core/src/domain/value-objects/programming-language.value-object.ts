/**
 * Supported normalized programming language literals.
 */
export const PROGRAMMING_LANGUAGE = {
    JSTS: "jsts",
    PYTHON: "python",
    GO: "go",
    JAVA: "java",
    CSHARP: "csharp",
    RUBY: "ruby",
    RUST: "rust",
    PHP: "php",
    KOTLIN: "kotlin",
    DART: "dart",
    SCALA: "scala",
    DOCKERFILE: "dockerfile",
    UNKNOWN: "unknown",
} as const

/**
 * Literal type for supported programming languages.
 */
export type ProgrammingLanguageValue =
    (typeof PROGRAMMING_LANGUAGE)[keyof typeof PROGRAMMING_LANGUAGE]

const EXTENSION_TO_LANGUAGE: Readonly<Record<string, ProgrammingLanguageValue>> = {
    js: PROGRAMMING_LANGUAGE.JSTS,
    jsx: PROGRAMMING_LANGUAGE.JSTS,
    ts: PROGRAMMING_LANGUAGE.JSTS,
    tsx: PROGRAMMING_LANGUAGE.JSTS,
    mjs: PROGRAMMING_LANGUAGE.JSTS,
    cjs: PROGRAMMING_LANGUAGE.JSTS,
    py: PROGRAMMING_LANGUAGE.PYTHON,
    go: PROGRAMMING_LANGUAGE.GO,
    java: PROGRAMMING_LANGUAGE.JAVA,
    cs: PROGRAMMING_LANGUAGE.CSHARP,
    rb: PROGRAMMING_LANGUAGE.RUBY,
    rs: PROGRAMMING_LANGUAGE.RUST,
    php: PROGRAMMING_LANGUAGE.PHP,
    kt: PROGRAMMING_LANGUAGE.KOTLIN,
    kts: PROGRAMMING_LANGUAGE.KOTLIN,
    dart: PROGRAMMING_LANGUAGE.DART,
    scala: PROGRAMMING_LANGUAGE.SCALA,
    sc: PROGRAMMING_LANGUAGE.SCALA,
    dockerfile: PROGRAMMING_LANGUAGE.DOCKERFILE,
}

const SHEBANG_TO_LANGUAGE_RULES: ReadonlyArray<{
    readonly pattern: RegExp
    readonly language: ProgrammingLanguageValue
}> = [
    {pattern: /\bpython[0-9.]*\b/, language: PROGRAMMING_LANGUAGE.PYTHON},
    {pattern: /\b(node|bun|deno)\b/, language: PROGRAMMING_LANGUAGE.JSTS},
    {pattern: /\bruby\b/, language: PROGRAMMING_LANGUAGE.RUBY},
    {pattern: /\bphp\b/, language: PROGRAMMING_LANGUAGE.PHP},
    {pattern: /\bjava\b/, language: PROGRAMMING_LANGUAGE.JAVA},
    {pattern: /\bkotlin\b/, language: PROGRAMMING_LANGUAGE.KOTLIN},
    {pattern: /\bscala\b/, language: PROGRAMMING_LANGUAGE.SCALA},
    {pattern: /\bgo\b/, language: PROGRAMMING_LANGUAGE.GO},
]

/**
 * Immutable value object for normalized language identification.
 */
export class ProgrammingLanguage {
    private readonly language: ProgrammingLanguageValue

    /**
     * Creates immutable programming language.
     *
     * @param language Normalized language literal.
     */
    private constructor(language: ProgrammingLanguageValue) {
        this.language = language
        Object.freeze(this)
    }

    /**
     * Detects language from file extension marker.
     *
     * @param extension Extension string with or without leading dot.
     * @returns Programming language value object.
     */
    public static fromExtension(extension: string): ProgrammingLanguage {
        const normalizedExtension = normalizeExtension(extension)

        const detectedLanguage =
            EXTENSION_TO_LANGUAGE[normalizedExtension] ?? PROGRAMMING_LANGUAGE.UNKNOWN
        return new ProgrammingLanguage(detectedLanguage)
    }

    /**
     * Detects language from shebang line.
     *
     * @param line First script line.
     * @returns Programming language value object.
     */
    public static fromShebang(line: string): ProgrammingLanguage {
        const normalizedLine = line.trim().toLowerCase()
        if (!normalizedLine.startsWith("#!")) {
            return new ProgrammingLanguage(PROGRAMMING_LANGUAGE.UNKNOWN)
        }

        for (const detectionRule of SHEBANG_TO_LANGUAGE_RULES) {
            if (detectionRule.pattern.test(normalizedLine)) {
                return new ProgrammingLanguage(detectionRule.language)
            }
        }

        return new ProgrammingLanguage(PROGRAMMING_LANGUAGE.UNKNOWN)
    }

    /**
     * Returns normalized language literal.
     *
     * @returns Language literal.
     */
    public toString(): ProgrammingLanguageValue {
        return this.language
    }
}

/**
 * Normalizes extension value to canonical lookup key.
 *
 * @param extension Raw extension value.
 * @returns Canonical lowercase extension key without leading dot.
 */
function normalizeExtension(extension: string): string {
    const normalizedValue = extension.trim().toLowerCase()
    if (normalizedValue.startsWith(".")) {
        return normalizedValue.slice(1)
    }

    return normalizedValue
}
