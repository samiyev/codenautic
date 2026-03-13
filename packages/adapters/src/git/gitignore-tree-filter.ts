import {
    FILE_TREE_NODE_TYPE,
    type IFileTreeNode,
} from "@codenautic/core"

const GIT_IGNORE_FILE_NAME = ".gitignore"

/**
 * Loaded `.gitignore` file used to filter repository tree nodes.
 */
export interface IGitIgnoreFile {
    /**
     * Repository-relative `.gitignore` path.
     */
    readonly path: string

    /**
     * Raw file content.
     */
    readonly content: string
}

interface IGitIgnoreRule {
    /**
     * Repository-relative directory containing the `.gitignore` file.
     */
    readonly baseDirectory: string

    /**
     * Normalized glob-like pattern without control markers.
     */
    readonly pattern: string

    /**
     * Marks include override (`!pattern`).
     */
    readonly isNegated: boolean

    /**
     * Restricts matches to directory candidates.
     */
    readonly directoryOnly: boolean

    /**
     * Signals whether pattern is evaluated against full relative path.
     */
    readonly hasSlash: boolean
}

interface IPathCandidate {
    /**
     * Candidate repository-relative path.
     */
    readonly path: string

    /**
     * Candidate basename segment.
     */
    readonly basename: string

    /**
     * True when candidate represents directory segment.
     */
    readonly isDirectory: boolean
}

/**
 * Checks whether repository path points to `.gitignore`.
 *
 * @param filePath Repository-relative path.
 * @returns True when path targets a `.gitignore` file.
 */
export function isGitIgnoreFilePath(filePath: string): boolean {
    const normalizedPath = normalizeGitPath(filePath)

    return (
        normalizedPath === GIT_IGNORE_FILE_NAME ||
        normalizedPath.endsWith(`/${GIT_IGNORE_FILE_NAME}`)
    )
}

/**
 * Filters repository tree nodes using loaded `.gitignore` files.
 *
 * @param treeNodes Repository tree nodes returned by provider API.
 * @param gitIgnoreFiles Loaded `.gitignore` files for the same ref.
 * @returns Filtered tree nodes with empty directories removed.
 */
export function filterFileTreeByGitIgnore(
    treeNodes: readonly IFileTreeNode[],
    gitIgnoreFiles: readonly IGitIgnoreFile[],
): readonly IFileTreeNode[] {
    const rules = buildGitIgnoreRules(gitIgnoreFiles)
    if (rules.length === 0) {
        return [...treeNodes]
    }

    const visibleNodes = treeNodes.filter((node): boolean => {
        return isNodeVisible(node, rules)
    })

    return pruneEmptyTreeNodes(visibleNodes)
}

/**
 * Parses ordered `.gitignore` files into matcher rules.
 *
 * @param gitIgnoreFiles Loaded `.gitignore` files.
 * @returns Flattened ordered rule list.
 */
function buildGitIgnoreRules(
    gitIgnoreFiles: readonly IGitIgnoreFile[],
): readonly IGitIgnoreRule[] {
    return gitIgnoreFiles
        .slice()
        .sort(compareGitIgnoreFiles)
        .flatMap((gitIgnoreFile): readonly IGitIgnoreRule[] => {
            return parseGitIgnoreFile(gitIgnoreFile)
        })
}

/**
 * Sorts `.gitignore` files from parent directories to nested directories.
 *
 * @param left First `.gitignore` file.
 * @param right Second `.gitignore` file.
 * @returns Stable comparison result.
 */
function compareGitIgnoreFiles(
    left: IGitIgnoreFile,
    right: IGitIgnoreFile,
): number {
    const leftDepth = resolvePathDepth(left.path)
    const rightDepth = resolvePathDepth(right.path)

    if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth
    }

    return left.path.localeCompare(right.path)
}

/**
 * Parses one `.gitignore` file into ordered rules.
 *
 * @param gitIgnoreFile Loaded `.gitignore` file.
 * @returns Rules extracted from file content.
 */
function parseGitIgnoreFile(
    gitIgnoreFile: IGitIgnoreFile,
): readonly IGitIgnoreRule[] {
    const baseDirectory = resolveGitIgnoreBaseDirectory(gitIgnoreFile.path)

    return gitIgnoreFile.content
        .split(/\r?\n/)
        .flatMap((rawLine): readonly IGitIgnoreRule[] => {
            const parsedRule = parseGitIgnoreRule(rawLine, baseDirectory)

            return parsedRule === undefined ? [] : [parsedRule]
        })
}

/**
 * Parses one `.gitignore` line into normalized rule metadata.
 *
 * @param rawLine Raw line from `.gitignore`.
 * @param baseDirectory Directory containing the `.gitignore`.
 * @returns Parsed rule or undefined when line should be ignored.
 */
function parseGitIgnoreRule(
    rawLine: string,
    baseDirectory: string,
): IGitIgnoreRule | undefined {
    const trimmedLine = rawLine.trim()
    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
        return undefined
    }

    let normalizedPattern = normalizeEscapedControlPrefix(trimmedLine)
    let isNegated = false

    if (normalizedPattern.startsWith("!")) {
        isNegated = true
        normalizedPattern = normalizedPattern.slice(1)
    }

    normalizedPattern = normalizeGitPath(normalizedPattern)
    if (normalizedPattern.length === 0) {
        return undefined
    }

    const directoryOnly = normalizedPattern.endsWith("/")
    if (directoryOnly) {
        normalizedPattern = normalizedPattern.replace(/\/+$/u, "")
    }

    normalizedPattern = normalizedPattern.replace(/^\/+/u, "")
    if (normalizedPattern.length === 0) {
        return undefined
    }

    return {
        baseDirectory,
        pattern: normalizedPattern,
        isNegated,
        directoryOnly,
        hasSlash: normalizedPattern.includes("/"),
    }
}

/**
 * Removes leading escape from literal `#` and `!` markers.
 *
 * @param pattern Candidate ignore pattern.
 * @returns Pattern without marker escape when present.
 */
function normalizeEscapedControlPrefix(pattern: string): string {
    if (pattern.startsWith("\\#") || pattern.startsWith("\\!")) {
        return pattern.slice(1)
    }

    return pattern
}

/**
 * Resolves repository-relative directory for `.gitignore` path.
 *
 * @param gitIgnorePath Repository-relative `.gitignore` path.
 * @returns Containing directory or empty string for root.
 */
function resolveGitIgnoreBaseDirectory(gitIgnorePath: string): string {
    const normalizedPath = normalizeGitPath(gitIgnorePath)
    const lastSlashIndex = normalizedPath.lastIndexOf("/")

    return lastSlashIndex === -1 ? "" : normalizedPath.slice(0, lastSlashIndex)
}

/**
 * Keeps only nodes that are not ignored by current rule set.
 *
 * @param node Repository tree node.
 * @param rules Ordered ignore rules.
 * @returns True when node remains visible.
 */
function isNodeVisible(
    node: IFileTreeNode,
    rules: readonly IGitIgnoreRule[],
): boolean {
    const normalizedPath = normalizeGitPath(node.path)

    return !isIgnoredByRules(
        normalizedPath,
        node.type === FILE_TREE_NODE_TYPE.TREE,
        rules,
    )
}

/**
 * Evaluates ordered ignore rules against one repository path.
 *
 * @param path Repository-relative path.
 * @param isDirectory True when path points to a tree node.
 * @param rules Ordered ignore rules.
 * @returns True when path should be filtered out.
 */
function isIgnoredByRules(
    path: string,
    isDirectory: boolean,
    rules: readonly IGitIgnoreRule[],
): boolean {
    let isIgnored = false

    for (const rule of rules) {
        const relativePath = resolveRelativePath(path, rule.baseDirectory)
        if (relativePath === undefined || relativePath.length === 0) {
            continue
        }

        if (!matchesGitIgnoreRule(relativePath, isDirectory, rule)) {
            continue
        }

        isIgnored = !rule.isNegated
    }

    return isIgnored
}

/**
 * Resolves path relative to directory containing `.gitignore`.
 *
 * @param path Repository-relative target path.
 * @param baseDirectory Directory containing `.gitignore`.
 * @returns Relative path or undefined when rule does not apply.
 */
function resolveRelativePath(
    path: string,
    baseDirectory: string,
): string | undefined {
    if (baseDirectory.length === 0) {
        return path
    }

    if (path === baseDirectory) {
        return ""
    }

    const directoryPrefix = `${baseDirectory}/`
    if (!path.startsWith(directoryPrefix)) {
        return undefined
    }

    return path.slice(directoryPrefix.length)
}

/**
 * Checks whether one rule matches current repository path.
 *
 * @param relativePath Path relative to `.gitignore` directory.
 * @param isDirectory True when target is directory.
 * @param rule Parsed `.gitignore` rule.
 * @returns True when rule matches current target.
 */
function matchesGitIgnoreRule(
    relativePath: string,
    isDirectory: boolean,
    rule: IGitIgnoreRule,
): boolean {
    const matcher = createGlobRegex(rule.pattern)
    const candidates = buildPathCandidates(relativePath, isDirectory)

    return candidates.some((candidate): boolean => {
        if (rule.directoryOnly && !candidate.isDirectory) {
            return false
        }

        return matcher.test(rule.hasSlash ? candidate.path : candidate.basename)
    })
}

/**
 * Builds candidate paths and basenames for one target path.
 *
 * @param relativePath Path relative to `.gitignore` directory.
 * @param isDirectory True when target itself is directory.
 * @returns Ordered candidates from parent to leaf.
 */
function buildPathCandidates(
    relativePath: string,
    isDirectory: boolean,
): readonly IPathCandidate[] {
    const segments = relativePath.split("/").filter((segment): boolean => {
        return segment.length > 0
    })
    const candidates: IPathCandidate[] = []
    let currentPath = ""

    for (const [index, segment] of segments.entries()) {
        currentPath =
            currentPath.length === 0 ? segment : `${currentPath}/${segment}`

        candidates.push({
            path: currentPath,
            basename: segment,
            isDirectory: isDirectory || index < segments.length - 1,
        })
    }

    return candidates
}

/**
 * Removes tree nodes that do not have any visible descendants.
 *
 * @param nodes Visible tree nodes after ignore filtering.
 * @returns Tree nodes without empty directories.
 */
function pruneEmptyTreeNodes(
    nodes: readonly IFileTreeNode[],
): readonly IFileTreeNode[] {
    const nonEmptyTreePaths = collectNonEmptyTreePaths(nodes)

    return nodes.filter((node): boolean => {
        return (
            node.type !== FILE_TREE_NODE_TYPE.TREE ||
            nonEmptyTreePaths.has(normalizeGitPath(node.path))
        )
    })
}

/**
 * Collects tree paths that still have visible descendants.
 *
 * @param nodes Visible repository nodes.
 * @returns Set of non-empty tree paths.
 */
function collectNonEmptyTreePaths(
    nodes: readonly IFileTreeNode[],
): ReadonlySet<string> {
    const treePaths = new Set<string>()

    for (const node of nodes) {
        for (const ancestorPath of collectAncestorDirectories(node.path)) {
            treePaths.add(ancestorPath)
        }
    }

    return treePaths
}

/**
 * Collects ancestor directories for repository-relative path.
 *
 * @param path Repository-relative path.
 * @returns Ancestor directory paths.
 */
function collectAncestorDirectories(path: string): readonly string[] {
    const normalizedPath = normalizeGitPath(path)
    const segments = normalizedPath.split("/").filter((segment): boolean => {
        return segment.length > 0
    })
    const ancestors: string[] = []

    for (let index = 0; index < segments.length - 1; index += 1) {
        const ancestorPath = segments.slice(0, index + 1).join("/")
        ancestors.push(ancestorPath)
    }

    return ancestors
}

/**
 * Converts glob-like pattern into anchored regular expression.
 *
 * Supported operators:
 * - `*` matches zero or more non-separator characters
 * - `**` matches zero or more characters including separators
 * - `?` matches one non-separator character
 *
 * @param pattern Normalized glob-like pattern.
 * @returns Anchored regular expression.
 */
function createGlobRegex(pattern: string): RegExp {
    let regexSource = "^"

    for (let index = 0; index < pattern.length; index += 1) {
        const character = pattern.charAt(index)
        const nextCharacter = pattern.charAt(index + 1)

        if (character === "*") {
            if (nextCharacter === "*") {
                regexSource += ".*"
                index += 1
            } else {
                regexSource += "[^/]*"
            }
            continue
        }

        if (character === "?") {
            regexSource += "[^/]"
            continue
        }

        regexSource += escapeRegexCharacter(character)
    }

    regexSource += "$"
    return new RegExp(regexSource)
}

/**
 * Escapes regular-expression control characters.
 *
 * @param value Source character.
 * @returns Escaped literal character.
 */
function escapeRegexCharacter(value: string): string {
    return /[-/\\^$+?.()|[\]{}]/u.test(value) ? `\\${value}` : value
}

/**
 * Normalizes repository-relative path separators.
 *
 * @param value Raw repository-relative path.
 * @returns Trimmed path with forward slashes.
 */
function normalizeGitPath(value: string): string {
    return value.trim().replaceAll("\\", "/")
}

/**
 * Resolves path depth for stable parent-first sorting.
 *
 * @param path Repository-relative path.
 * @returns Segment depth.
 */
function resolvePathDepth(path: string): number {
    return normalizeGitPath(path).split("/").filter((segment): boolean => {
        return segment.length > 0
    }).length
}
