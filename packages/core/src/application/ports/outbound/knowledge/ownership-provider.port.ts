import type {
    IFileOwnership,
    IOwnershipContributor,
} from "../../../dto/knowledge/file-ownership.dto"

/**
 * Outbound contract for repository ownership analytics.
 */
export interface IOwnershipProvider {
    /**
     * Returns ownership snapshot for requested repository files.
     *
     * @param repositoryId Repository identifier.
     * @param filePaths Repository-relative file paths.
     * @returns File ownership list in input order.
     */
    getFileOwnership(
        repositoryId: string,
        filePaths: readonly string[],
    ): Promise<readonly IFileOwnership[]>

    /**
     * Returns repository contributors sorted by adapter-defined order.
     *
     * @param repositoryId Repository identifier.
     * @returns Contributor summary list.
     */
    getContributors(repositoryId: string): Promise<readonly IOwnershipContributor[]>
}
