import type {
    CheckRunConclusion,
    CheckRunStatus,
    ICheckRunDTO,
    ICommentDTO,
    IInlineCommentDTO,
    IFileTreeNode,
    IMergeRequestDTO,
    IMergeRequestDiffFileDTO,
} from "../../../dto/git"

/**
 * Outbound contract for Git platform integration.
 */
export interface IGitProvider {
    /**
     * Fetches merge request by identifier.
     *
     * @param id Merge request identifier.
     * @returns Merge request payload.
     */
    getMergeRequest(id: string): Promise<IMergeRequestDTO>

    /**
     * Fetches changed files for merge request.
     *
     * @param mergeRequestId Merge request identifier.
     * @returns Changed files list.
     */
    getChangedFiles(mergeRequestId: string): Promise<readonly IMergeRequestDiffFileDTO[]>

    /**
     * Fetches repository file tree for a commit/branch reference.
     *
     * @param ref Commit SHA or branch name.
     * @returns File tree nodes.
     */
    getFileTree(ref: string): Promise<readonly IFileTreeNode[]>

    /**
     * Posts regular comment to merge request.
     *
     * @param mergeRequestId Merge request identifier.
     * @param body Comment body.
     * @returns Created comment payload.
     */
    postComment(mergeRequestId: string, body: string): Promise<ICommentDTO>

    /**
     * Posts inline comment to merge request.
     *
     * @param mergeRequestId Merge request identifier.
     * @param comment Inline comment payload.
     * @returns Created inline comment payload.
     */
    postInlineComment(mergeRequestId: string, comment: IInlineCommentDTO): Promise<IInlineCommentDTO>

    /**
     * Creates check run attached to merge request.
     *
     * @param mergeRequestId Merge request identifier.
     * @param name Check run name.
     * @returns Created check run payload.
     */
    createCheckRun(mergeRequestId: string, name: string): Promise<ICheckRunDTO>

    /**
     * Updates check run status and conclusion.
     *
     * @param checkId Check run identifier.
     * @param status Target status.
     * @param conclusion Target conclusion.
     * @returns Updated check run payload.
     */
    updateCheckRun(
        checkId: string,
        status: CheckRunStatus,
        conclusion: CheckRunConclusion,
    ): Promise<ICheckRunDTO>
}
