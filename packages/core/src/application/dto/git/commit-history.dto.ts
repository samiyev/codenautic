/**
 * Git commit history query input for a specific branch/commit reference.
 */
export interface ICommitHistoryOptions {
    /**
     * Filter commits by platform-native author identifier.
     */
    readonly author?: string

    /**
     * Include commits after ISO-8601 timestamp.
     */
    readonly since?: string

    /**
     * Include commits before ISO-8601 timestamp.
     */
    readonly until?: string

    /**
     * Maximum number of commits to return.
     */
    readonly maxCount?: number

    /**
     * Filter commits that touch specific repository path.
     *
     * Supports both file and directory paths.
     */
    readonly path?: string

    /**
     * Backward-compatible alias for `path`.
     */
    readonly filePath?: string
}

/**
 * Commit metadata returned by platform history APIs.
 */
export interface ICommitInfo {
    /**
     * Commit SHA identifier.
     */
    readonly sha: string

    /**
     * Commit message body.
     */
    readonly message: string

    /**
     * Commit author name.
     */
    readonly authorName: string

    /**
     * Commit author email.
     */
    readonly authorEmail: string

    /**
     * Commit timestamp in ISO 8601 format.
     */
    readonly date: string

    /**
     * Changed files included in commit.
     */
    readonly filesChanged: readonly string[]
}
