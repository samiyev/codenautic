/**
 * Associated commit metadata for one repository tag.
 */
export interface ITagCommitInfo {
    /**
     * Commit SHA resolved from tag target.
     */
    readonly sha: string

    /**
     * Commit message of the associated commit.
     */
    readonly message: string

    /**
     * Commit timestamp in ISO 8601 format.
     */
    readonly date: string
}

/**
 * Repository tag metadata returned by git providers.
 */
export interface ITagInfo {
    /**
     * Tag name.
     */
    readonly name: string

    /**
     * Git reference target SHA.
     *
     * For lightweight tags this is the commit SHA.
     * For annotated tags this is the tag object SHA.
     */
    readonly sha: string

    /**
     * Indicates whether tag uses annotated tag object.
     */
    readonly isAnnotated: boolean

    /**
     * Annotated tag message when upstream tag stores one.
     */
    readonly annotationMessage?: string

    /**
     * Primary tag timestamp used for stable ordering.
     *
     * Annotated tags use tagger date.
     * Lightweight tags fall back to the associated commit date.
     */
    readonly date: string

    /**
     * Associated commit resolved from the tag target.
     */
    readonly commit: ITagCommitInfo
}
