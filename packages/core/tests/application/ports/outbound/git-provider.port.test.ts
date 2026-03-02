import {describe, expect, test} from "bun:test"

import {
    CHECK_RUN_CONCLUSION,
    CHECK_RUN_STATUS,
    INLINE_COMMENT_SIDE,
    MERGE_REQUEST_DIFF_FILE_STATUS,
    type CheckRunConclusion,
    type CheckRunStatus,
    type ICheckRunDTO,
    type ICommentDTO,
    type IGitProvider,
    type IInlineCommentDTO,
    type IMergeRequestDTO,
    type IMergeRequestDiffFileDTO,
} from "../../../../src"

class InMemoryGitProvider implements IGitProvider {
    public getMergeRequest(id: string): Promise<IMergeRequestDTO> {
        return Promise.resolve({
            id,
            number: 10,
            title: "Improve contract coverage",
            description: "Add missing adapter contract tests",
            sourceBranch: "feature/contracts",
            targetBranch: "main",
            author: {
                id: "user-1",
                username: "alice",
                displayName: "Alice",
            },
            state: "opened",
            commits: [
                {
                    id: "abc123",
                    message: "add contracts",
                    author: "Alice",
                    timestamp: "2026-03-03T08:00:00.000Z",
                },
            ],
            diffFiles: [
                {
                    path: "src/contracts.ts",
                    status: MERGE_REQUEST_DIFF_FILE_STATUS.MODIFIED,
                    patch: "@@ -1,1 +1,2 @@",
                    hunks: ["@@ -1,1 +1,2 @@"],
                },
            ],
        })
    }

    public getChangedFiles(_mergeRequestId: string): Promise<readonly IMergeRequestDiffFileDTO[]> {
        return Promise.resolve([
            {
                path: "src/contracts.ts",
                status: MERGE_REQUEST_DIFF_FILE_STATUS.MODIFIED,
                patch: "@@ -1,1 +1,2 @@",
                hunks: ["@@ -1,1 +1,2 @@"],
            },
        ])
    }

    public postComment(_mergeRequestId: string, body: string): Promise<ICommentDTO> {
        return Promise.resolve({
            id: "comment-1",
            body,
            author: "review-bot",
            createdAt: "2026-03-03T08:10:00.000Z",
        })
    }

    public postInlineComment(
        _mergeRequestId: string,
        comment: IInlineCommentDTO,
    ): Promise<IInlineCommentDTO> {
        return Promise.resolve(comment)
    }

    public createCheckRun(_mergeRequestId: string, name: string): Promise<ICheckRunDTO> {
        return Promise.resolve({
            id: "check-1",
            name,
            status: CHECK_RUN_STATUS.QUEUED,
            conclusion: CHECK_RUN_CONCLUSION.NEUTRAL,
        })
    }

    public updateCheckRun(
        checkId: string,
        status: CheckRunStatus,
        conclusion: CheckRunConclusion,
    ): Promise<ICheckRunDTO> {
        return Promise.resolve({
            id: checkId,
            name: "CodeNautic Review",
            status,
            conclusion,
        })
    }
}

describe("IGitProvider contract", () => {
    test("provides merge request payload and changed files", async () => {
        const provider = new InMemoryGitProvider()

        const mergeRequest = await provider.getMergeRequest("mr-1")
        const files = await provider.getChangedFiles("mr-1")

        expect(mergeRequest.id).toBe("mr-1")
        expect(mergeRequest.diffFiles).toHaveLength(1)
        expect(files[0]?.status).toBe("modified")
    })

    test("posts comments and manages check runs", async () => {
        const provider = new InMemoryGitProvider()

        const comment = await provider.postComment("mr-1", "Looks good")
        const inlineComment = await provider.postInlineComment("mr-1", {
            id: "inline-1",
            body: "Null-check is required here",
            author: "review-bot",
            createdAt: "2026-03-03T08:11:00.000Z",
            filePath: "src/main.ts",
            line: 17,
            side: INLINE_COMMENT_SIDE.RIGHT,
        })
        const createdCheck = await provider.createCheckRun("mr-1", "CodeNautic Review")
        const updatedCheck = await provider.updateCheckRun(
            createdCheck.id,
            CHECK_RUN_STATUS.COMPLETED,
            CHECK_RUN_CONCLUSION.SUCCESS,
        )

        expect(comment.body).toBe("Looks good")
        expect(inlineComment.side).toBe("RIGHT")
        expect(createdCheck.status).toBe("queued")
        expect(updatedCheck.status).toBe("completed")
        expect(updatedCheck.conclusion).toBe("success")
    })
})
