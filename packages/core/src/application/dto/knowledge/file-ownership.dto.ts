/**
 * One contributor ownership snapshot for a single file.
 */
export interface IFileOwnershipContributor {
    /**
     * Contributor display name.
     */
    readonly name: string

    /**
     * Number of commits touching the file.
     */
    readonly commitCount: number

    /**
     * Last commit timestamp for the contributor and file.
     */
    readonly lastCommitDate: string

    /**
     * Total blamed lines attributed to the contributor.
     */
    readonly linesChanged: number
}

/**
 * File-level ownership snapshot used by knowledge and bus-factor features.
 */
export interface IFileOwnership {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Dominant contributor for the file.
     */
    readonly primaryOwner: string

    /**
     * Contributor ownership breakdown.
     */
    readonly contributors: readonly IFileOwnershipContributor[]

    /**
     * Last contributor who modified the file.
     */
    readonly lastModifiedBy: string

    /**
     * Latest file modification timestamp.
     */
    readonly lastModifiedDate: string

    /**
     * Minimal number of contributors covering 80% of file commits.
     */
    readonly busFactor: number
}

/**
 * Repository contributor summary returned by ownership providers.
 */
export interface IOwnershipContributor {
    /**
     * Contributor display name.
     */
    readonly name: string

    /**
     * Contributor email.
     */
    readonly email: string

    /**
     * Number of commits included in current aggregation window.
     */
    readonly commitCount: number
}
