/**
 * Immutable file path value object.
 */
export class FilePath {
    private readonly normalizedPath: string

    /**
     * Creates immutable file path.
     *
     * @param normalizedPath Normalized file path.
     */
    private constructor(normalizedPath: string) {
        this.normalizedPath = normalizedPath
        Object.freeze(this)
    }

    /**
     * Creates file path value object from raw input.
     *
     * @param value Raw file path.
     * @returns Immutable file path value object.
     * @throws Error When path is empty.
     */
    public static create(value: string): FilePath {
        const normalizedPath = normalizePath(value)
        if (normalizedPath.length === 0) {
            throw new Error("FilePath cannot be empty")
        }

        return new FilePath(normalizedPath)
    }

    /**
     * Returns file extension with leading dot.
     *
     * @returns File extension or empty string.
     */
    public extension(): string {
        const fileName = this.fileName()
        const extensionIndex = fileName.lastIndexOf(".")

        if (extensionIndex <= 0) {
            return ""
        }

        return fileName.slice(extensionIndex)
    }

    /**
     * Returns terminal file name segment.
     *
     * @returns File name segment.
     */
    public fileName(): string {
        const lastSlashIndex = this.normalizedPath.lastIndexOf("/")
        if (lastSlashIndex === -1) {
            return this.normalizedPath
        }

        return this.normalizedPath.slice(lastSlashIndex + 1)
    }

    /**
     * Returns parent directory segment.
     *
     * @returns Directory path or empty string.
     */
    public directory(): string {
        const lastSlashIndex = this.normalizedPath.lastIndexOf("/")

        if (lastSlashIndex === -1) {
            return ""
        }

        if (lastSlashIndex === 0) {
            return "/"
        }

        return this.normalizedPath.slice(0, lastSlashIndex)
    }

    /**
     * Checks whether file path matches glob-like pattern.
     *
     * @param pattern Glob pattern.
     * @returns True when path matches pattern.
     */
    public matchesGlob(pattern: string): boolean {
        const normalizedPattern = normalizePath(pattern)
        if (normalizedPattern.length === 0) {
            return false
        }

        const patternRegex = globPatternToRegex(normalizedPattern)
        return patternRegex.test(this.normalizedPath)
    }

    /**
     * Returns normalized file path string.
     *
     * @returns File path string.
     */
    public toString(): string {
        return this.normalizedPath
    }
}

/**
 * Normalizes path separators and trims surrounding spaces.
 *
 * @param value Raw path.
 * @returns Normalized path.
 */
function normalizePath(value: string): string {
    return value.trim().replaceAll("\\", "/")
}

/**
 * Converts glob-like pattern to regular expression.
 *
 * Supported operators:
 * - `*` matches zero or more non-separator chars
 * - `**` matches zero or more chars including separators
 * - `?` matches one non-separator char
 *
 * @param pattern Glob-like pattern.
 * @returns Compiled regular expression.
 */
function globPatternToRegex(pattern: string): RegExp {
    let regexSource = "^"

    for (let index = 0; index < pattern.length; index++) {
        const char = pattern.charAt(index)
        const nextChar = pattern.charAt(index + 1)

        if (char === "*") {
            if (nextChar === "*") {
                regexSource += ".*"
                index += 1
            } else {
                regexSource += "[^/]*"
            }
            continue
        }

        if (char === "?") {
            regexSource += "[^/]"
            continue
        }

        regexSource += escapeRegexCharacter(char)
    }

    regexSource += "$"
    return new RegExp(regexSource)
}

/**
 * Escapes regex control characters.
 *
 * @param value Source character.
 * @returns Escaped character for regex source.
 */
function escapeRegexCharacter(value: string): string {
    if (/[-/\\^$+?.()|[\]{}]/.test(value)) {
        return `\\${value}`
    }

    return value
}
