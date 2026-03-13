/**
 * Git branch metadata returned by repository provider.
 */
export interface IBranchInfo {
    /**
     * Branch name.
     */
    readonly name: string

    /**
     * Branch head commit SHA.
     */
    readonly sha: string

    /**
     * Marks repository default branch.
     */
    readonly isDefault: boolean

    /**
     * Indicates protected branch policy.
     */
    readonly isProtected: boolean

    /**
     * Head commit timestamp in ISO 8601 format.
     */
    readonly lastCommitDate: string
}
