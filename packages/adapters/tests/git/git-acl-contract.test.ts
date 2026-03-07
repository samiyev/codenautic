import {describe, expect, test} from "bun:test"

import {
    GIT_ACL_ERROR_KIND,
    GitDiffFilesAcl,
    GitErrorAcl,
    GitIdempotencyAcl,
    GitMergeRequestAcl,
    createGitAclIdempotencyKey,
    mapExternalDiffFiles,
    mapExternalMergeRequest,
    normalizeGitAclError,
    shouldRetryGitAclError,
} from "../../src/git/acl"

describe("Git ACL contract", () => {
    test("maps happy-path external merge request payload to domain DTO", () => {
        const result = mapExternalMergeRequest({
            id: 42,
            number: 7,
            title: " Add feature ",
            description: "Description",
            source_branch: "feature/login",
            target_branch: "main",
            state: "opened",
            author: {
                id: 100,
                username: "alice",
                display_name: "Alice",
                sdkOnlyField: "external",
            },
            commits: [
                {
                    sha: "abc123",
                    message: "Initial commit",
                    author_name: "Alice",
                    created_at: "2026-03-07T10:00:00.000Z",
                },
            ],
            changes: [
                {
                    new_path: "src/login.ts",
                    old_path: "src/auth.ts",
                    change_type: "renamed",
                    diff: "@@ -1 +1 @@\n-old\n+new",
                    hunks: ["@@ -1 +1 @@", "-old", "+new"],
                },
            ],
            providerSdkPayload: {
                nested: true,
            },
        })

        expect(result).toEqual({
            id: "42",
            number: 7,
            title: "Add feature",
            description: "Description",
            sourceBranch: "feature/login",
            targetBranch: "main",
            author: {
                id: "100",
                username: "alice",
                displayName: "Alice",
            },
            state: "opened",
            commits: [
                {
                    id: "abc123",
                    message: "Initial commit",
                    author: "Alice",
                    timestamp: "2026-03-07T10:00:00.000Z",
                },
            ],
            diffFiles: [
                {
                    path: "src/login.ts",
                    status: "renamed",
                    oldPath: "src/auth.ts",
                    patch: "@@ -1 +1 @@\n-old\n+new",
                    hunks: ["@@ -1 +1 @@", "-old", "+new"],
                },
            ],
        })
    })

    test("normalizes partial and invalid external data without sdk type leakage", () => {
        const result = mapExternalMergeRequest({
            iid: "13",
            title: 404,
            author: "invalid-author",
            commits: [
                {
                    unsupported: "value",
                },
            ],
            diffFiles: [
                {
                    path: "src/partial.ts",
                    status: "unexpected_status",
                    diff: 123,
                },
            ],
        })

        expect(result.id).toBe("13")
        expect(result.number).toBe(13)
        expect(result.title).toBe("404")
        expect(result.sourceBranch).toBe("")
        expect(result.targetBranch).toBe("")
        expect(result.author).toEqual({
            id: "unknown",
            username: "unknown",
            displayName: "unknown",
        })
        expect(result.commits[0]).toEqual({
            id: "",
            message: "",
            author: "",
            timestamp: "",
        })
        expect(result.diffFiles[0]).toEqual({
            path: "src/partial.ts",
            status: "modified",
            patch: "",
            hunks: [],
        })

        expect(Object.keys(result).sort()).toEqual([
            "author",
            "commits",
            "description",
            "diffFiles",
            "id",
            "number",
            "sourceBranch",
            "state",
            "targetBranch",
            "title",
        ])
    })

    test("normalizes rate limit errors and exposes retry metadata", () => {
        const normalized = normalizeGitAclError({
            status: 429,
            message: "Too Many Requests",
            headers: {
                "retry-after": "3",
            },
        })

        expect(normalized).toEqual({
            kind: GIT_ACL_ERROR_KIND.RATE_LIMITED,
            message: "Too Many Requests",
            statusCode: 429,
            retryAfterMs: 3000,
            isRetryable: true,
        })
    })

    test("normalizes 5xx and network errors as retryable", () => {
        const serverError = normalizeGitAclError({
            statusCode: 503,
            message: "Service unavailable",
        })
        const networkError = normalizeGitAclError({
            code: "ETIMEDOUT",
            message: "socket timeout",
        })

        expect(serverError.kind).toBe(GIT_ACL_ERROR_KIND.SERVER_ERROR)
        expect(serverError.isRetryable).toBe(true)
        expect(networkError.kind).toBe(GIT_ACL_ERROR_KIND.SERVER_ERROR)
        expect(networkError.isRetryable).toBe(true)
    })

    test("normalizes auth, not-found and validation errors as non-retryable", () => {
        const auth = normalizeGitAclError({
            statusCode: 401,
            message: "unauthorized",
        })
        const notFound = normalizeGitAclError({
            statusCode: 404,
            message: "missing",
        })
        const validation = normalizeGitAclError({
            statusCode: 422,
            message: "invalid",
        })

        expect(auth.kind).toBe(GIT_ACL_ERROR_KIND.AUTH)
        expect(auth.isRetryable).toBe(false)
        expect(notFound.kind).toBe(GIT_ACL_ERROR_KIND.NOT_FOUND)
        expect(notFound.isRetryable).toBe(false)
        expect(validation.kind).toBe(GIT_ACL_ERROR_KIND.VALIDATION)
        expect(validation.isRetryable).toBe(false)
    })

    test("normalizes unknown errors and supports nested response status parsing", () => {
        const unknown = normalizeGitAclError({})
        const nestedStatus = normalizeGitAclError({
            response: {
                status: "502",
            },
            retryAfterMs: 1200,
        })

        expect(unknown).toEqual({
            kind: GIT_ACL_ERROR_KIND.UNKNOWN,
            message: "Unknown git ACL error",
            statusCode: undefined,
            isRetryable: false,
        })
        expect(nestedStatus.kind).toBe(GIT_ACL_ERROR_KIND.SERVER_ERROR)
        expect(nestedStatus.retryAfterMs).toBe(1200)
    })

    test("uses native error message and handles null-like records", () => {
        const normalized = normalizeGitAclError(new Error("native failure"))

        expect(normalized).toEqual({
            kind: GIT_ACL_ERROR_KIND.UNKNOWN,
            message: "native failure",
            statusCode: undefined,
            isRetryable: false,
        })
    })

    test("parses retry-after header with fractional seconds", () => {
        const normalized = normalizeGitAclError({
            statusCode: 429,
            message: "rate",
            headers: {
                "retry-after": "1.5",
            },
        })

        expect(normalized.retryAfterMs).toBe(1500)
    })

    test("respects retry expectations by attempt window", () => {
        const rateLimited = {
            statusCode: 429,
            message: "rate limited",
        }

        expect(shouldRetryGitAclError(rateLimited, 1, 3)).toBe(true)
        expect(shouldRetryGitAclError(rateLimited, 2, 3)).toBe(true)
        expect(shouldRetryGitAclError(rateLimited, 3, 3)).toBe(false)

        const validationError = {
            statusCode: 400,
            message: "bad request",
        }

        expect(shouldRetryGitAclError(validationError, 1, 3)).toBe(false)
        expect(shouldRetryGitAclError(rateLimited, 0, 3)).toBe(false)
        expect(shouldRetryGitAclError(rateLimited, 1, 0)).toBe(false)
    })

    test("builds deterministic idempotency keys", () => {
        const first = createGitAclIdempotencyKey({
            provider: " GitHub ",
            operation: " Post Comment ",
            mergeRequestId: " MR-77 ",
            requestId: " req-1 ",
        })
        const second = createGitAclIdempotencyKey({
            provider: "github",
            operation: "post   comment",
            mergeRequestId: "mr-77",
            requestId: "req-1",
        })
        const third = createGitAclIdempotencyKey({
            provider: "github",
            operation: "post comment",
            mergeRequestId: "mr-77",
        })

        expect(first).toBe("git:github:post-comment:mr-77:req-1")
        expect(second).toBe(first)
        expect(third).toBe("git:github:post-comment:mr-77:no-request-id")
    })

    test("normalizes empty idempotency segments to undefined token", () => {
        const key = createGitAclIdempotencyKey({
            provider: " ",
            operation: " ",
            mergeRequestId: " ",
            requestId: " ",
        })

        expect(key).toBe("git:undefined:undefined:undefined:undefined")
    })

    test("maps diff files from changes list with defaults", () => {
        const diffs = mapExternalDiffFiles([
            {
                new_path: "src/a.ts",
                change_type: "added",
                diff: "@@ hunk @@",
            },
            {
                path: "src/b.ts",
                status: "removed",
            },
        ])

        expect(diffs).toEqual([
            {
                path: "src/a.ts",
                status: "added",
                patch: "@@ hunk @@",
                hunks: ["@@ hunk @@"],
            },
            {
                path: "src/b.ts",
                status: "deleted",
                patch: "",
                hunks: [],
            },
        ])
    })

    test("fills numeric fallback fields when external identifiers are absent", () => {
        const result = mapExternalMergeRequest({})

        expect(result.id).toBe("")
        expect(result.number).toBe(0)
    })

    test("exposes class-based ACL wrappers for mapping and error normalization", () => {
        const mergeRequestAcl = new GitMergeRequestAcl()
        const diffFilesAcl = new GitDiffFilesAcl()
        const errorAcl = new GitErrorAcl()
        const idempotencyAcl = new GitIdempotencyAcl()

        const mergeRequest = mergeRequestAcl.toDomain({
            id: 1,
            title: "title",
            author: {
                id: 2,
                username: "u",
                display_name: "d",
            },
        })
        const diffFiles = diffFilesAcl.toDomain([
            {
                path: "src/a.ts",
                status: "added",
                diff: "@@ hunk @@",
            },
        ])
        const error = errorAcl.toDomain({
            statusCode: 429,
            message: "rate limit",
        })
        const shouldRetry = errorAcl.shouldRetry(
            {
                statusCode: 503,
                message: "service unavailable",
            },
            1,
            2,
        )
        const key = idempotencyAcl.build({
            provider: "github",
            operation: "comment",
            mergeRequestId: "77",
        })

        expect(mergeRequest.id).toBe("1")
        expect(diffFiles[0]?.path).toBe("src/a.ts")
        expect(error.kind).toBe(GIT_ACL_ERROR_KIND.RATE_LIMITED)
        expect(shouldRetry).toBe(true)
        expect(key).toBe("git:github:comment:77:no-request-id")
    })
})
