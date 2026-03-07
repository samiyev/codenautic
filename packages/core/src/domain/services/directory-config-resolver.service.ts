import {FilePath} from "../value-objects/file-path.value-object"
import type {IDirectoryConfig} from "../value-objects/directory-config.value-object"

/**
 * Resolves directory-level config overrides by specificity.
 */
export class DirectoryConfigResolverService {
    private readonly directories: readonly IDirectoryConfig<Readonly<Record<string, unknown>>>[]

    /**
     * Creates resolver instance.
     *
     * @param directories Directory configuration list.
     */
    public constructor(
        directories: readonly IDirectoryConfig<Readonly<Record<string, unknown>>>[],
    ) {
        this.directories = directories
    }

    /**
     * Resolves the most specific directory config for the given file path.
     *
     * @param filePath File path string.
     * @returns Matched directory config or null.
     */
    public resolve(
        filePath: string,
    ): IDirectoryConfig<Readonly<Record<string, unknown>>> | null {
        const normalizedPath = filePath.trim()
        if (normalizedPath.length === 0) {
            return null
        }

        const path = FilePath.create(normalizedPath)
        return this.resolveMatchingDirectoryConfig(path)
    }

    /**
     * Chooses the most specific matching directory override.
     *
     * @param filePath File path value object.
     * @returns Matching config or null.
     */
    private resolveMatchingDirectoryConfig(
        filePath: FilePath,
    ): IDirectoryConfig<Readonly<Record<string, unknown>>> | null {
        let selectedDirectory: IDirectoryConfig<Readonly<Record<string, unknown>>> | null = null
        let bestSpecificity = -1
        let bestIndex = -1

        for (let index = 0; index < this.directories.length; index += 1) {
            const directoryConfig = this.directories[index]
            if (directoryConfig === undefined) {
                continue
            }

            if (this.isDirectoryMatch(filePath, directoryConfig.path) === false) {
                continue
            }

            const specificity = this.calculateDirectorySpecificity(directoryConfig.path)
            if (
                specificity > bestSpecificity ||
                (specificity === bestSpecificity && index > bestIndex)
            ) {
                selectedDirectory = directoryConfig
                bestSpecificity = specificity
                bestIndex = index
            }
        }

        return selectedDirectory
    }

    /**
     * Checks whether file path matches configured directory rule.
     *
     * @param filePath File path.
     * @param directoryPath Directory matcher.
     * @returns True when path matches directory rule.
     */
    private isDirectoryMatch(filePath: FilePath, directoryPath: string): boolean {
        const normalizedPath = this.normalizeDirectoryPath(directoryPath)
        if (normalizedPath.length === 0) {
            return false
        }

        const normalizedFilePath = filePath.toString()
        if (this.isGlobPattern(normalizedPath) === true) {
            return filePath.matchesGlob(normalizedPath)
        }

        if (normalizedFilePath === normalizedPath) {
            return true
        }

        return normalizedFilePath.startsWith(`${normalizedPath}/`)
    }

    /**
     * Checks whether directory pattern contains wildcards.
     *
     * @param path Pattern.
     * @returns True when wildcard tokens are present.
     */
    private isGlobPattern(path: string): boolean {
        return path.includes("*") || path.includes("?")
    }

    /**
     * Calculates pattern precedence for conflicting directory overrides.
     *
     * @param path Directory pattern.
     * @returns Numeric specificity score.
     */
    private calculateDirectorySpecificity(path: string): number {
        const normalizedPath = this.normalizeDirectoryPath(path)
        if (this.isGlobPattern(normalizedPath) === false) {
            return normalizedPath.length + 1000
        }

        return normalizedPath.length
    }

    /**
     * Normalizes directory rule path before matching.
     *
     * @param path Raw directory path.
     * @returns Normalized path.
     */
    private normalizeDirectoryPath(path: string): string {
        const normalized = path.trim().replaceAll("\\", "/")
        if (normalized.length === 0) {
            return ""
        }

        let result = normalized
        if (result.startsWith("./")) {
            result = result.slice(2)
        }

        while (result.startsWith("/")) {
            result = result.slice(1)
        }

        while (result.length > 1 && result.endsWith("/")) {
            result = result.slice(0, -1)
        }

        return result
    }
}
