/**
 * Result of repository scanning operation.
 */
export interface ILanguageStat {
    /**
     * Programming language name (for example, "TypeScript", "Python").
     */
    readonly language: string

    /**
     * Number of files discovered in this language.
     */
    readonly fileCount: number

    /**
     * Aggregate lines of code for files of this language.
     */
    readonly loc: number
}

/**
 * Aggregate metrics produced by repository scanning pipeline.
 */
export interface IScanResult {
    /**
     * Unique scan operation identifier.
     */
    readonly scanId: string

    /**
     * Repository identifier in system scope.
     */
    readonly repositoryId: string

    /**
     * Total number of files processed during scan.
     */
    readonly totalFiles: number

    /**
     * Total number of AST graph nodes created.
     */
    readonly totalNodes: number

    /**
     * Total number of AST graph edges created.
     */
    readonly totalEdges: number

    /**
     * Language statistics aggregated during scan.
     */
    readonly languages: readonly ILanguageStat[]

    /**
     * Scan duration in milliseconds.
     */
    readonly duration: number

    /**
     * Scan completion timestamp in ISO 8601 format.
     */
    readonly completedAt: string
}
