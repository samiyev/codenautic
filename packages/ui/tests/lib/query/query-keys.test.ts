import { describe, expect, it } from "vitest"

import { queryKeys } from "@/lib/query/query-keys"

describe("queryKeys", (): void => {
    describe("auth", (): void => {
        it("when session is called, then returns auth session key", (): void => {
            expect(queryKeys.auth.session()).toEqual(["auth", "session"])
        })
    })

    describe("featureFlags", (): void => {
        it("when all is called, then returns feature-flags key", (): void => {
            expect(queryKeys.featureFlags.all()).toEqual(["feature-flags"])
        })
    })

    describe("permissions", (): void => {
        it("when all is called, then returns permissions key", (): void => {
            expect(queryKeys.permissions.all()).toEqual(["permissions"])
        })

        it("when byRole is called with admin, then returns scoped key", (): void => {
            expect(queryKeys.permissions.byRole("admin")).toEqual([
                "permissions",
                "by-role",
                "admin",
            ])
        })

        it("when byRole is called with empty string, then includes empty string", (): void => {
            expect(queryKeys.permissions.byRole("")).toEqual(["permissions", "by-role", ""])
        })
    })

    describe("system", (): void => {
        it("when health is called, then returns system health key", (): void => {
            expect(queryKeys.system.health()).toEqual(["system", "health"])
        })
    })

    describe("customRules", (): void => {
        it("when all is called, then returns custom-rules key", (): void => {
            expect(queryKeys.customRules.all()).toEqual(["custom-rules"])
        })

        it("when list is called without params, then returns key with undefined filters", (): void => {
            const result = queryKeys.customRules.list()
            expect(result[0]).toBe("custom-rules")
            expect(result[1]).toBe("list")
            expect(result[2]).toEqual({ scope: undefined, status: undefined })
        })

        it("when list is called with scope, then includes scope in filter", (): void => {
            const result = queryKeys.customRules.list("file")
            expect(result[2]).toEqual({ scope: "file", status: undefined })
        })

        it("when list is called with scope and status, then includes both in filter", (): void => {
            const result = queryKeys.customRules.list("ccr", "active")
            expect(result[2]).toEqual({ scope: "ccr", status: "active" })
        })
    })

    describe("externalContext", (): void => {
        it("when all is called, then returns external-context key", (): void => {
            expect(queryKeys.externalContext.all()).toEqual(["external-context"])
        })

        it("when sources is called, then returns sources key", (): void => {
            expect(queryKeys.externalContext.sources()).toEqual(["external-context", "sources"])
        })

        it("when preview is called with sourceId, then returns scoped preview key", (): void => {
            expect(queryKeys.externalContext.preview("jira-123")).toEqual([
                "external-context",
                "preview",
                "jira-123",
            ])
        })
    })

    describe("repoConfig", (): void => {
        it("when all is called, then returns repo-config key", (): void => {
            expect(queryKeys.repoConfig.all()).toEqual(["repo-config"])
        })

        it("when byRepository is called, then returns scoped key", (): void => {
            expect(queryKeys.repoConfig.byRepository("repo-42")).toEqual([
                "repo-config",
                "by-repository",
                "repo-42",
            ])
        })
    })

    describe("dryRun", (): void => {
        it("when all is called, then returns dry-run key", (): void => {
            expect(queryKeys.dryRun.all()).toEqual(["dry-run"])
        })

        it("when byRepository is called, then returns scoped key", (): void => {
            expect(queryKeys.dryRun.byRepository("repo-99")).toEqual([
                "dry-run",
                "by-repository",
                "repo-99",
            ])
        })
    })

    describe("ccrSummary", (): void => {
        it("when all is called, then returns ccr-summary key", (): void => {
            expect(queryKeys.ccrSummary.all()).toEqual(["ccr-summary"])
        })

        it("when byRepository is called, then returns scoped key", (): void => {
            expect(queryKeys.ccrSummary.byRepository("repo-7")).toEqual([
                "ccr-summary",
                "by-repository",
                "repo-7",
            ])
        })
    })

    describe("ccrWorkspace", (): void => {
        it("when all is called, then returns ccr-workspace key", (): void => {
            expect(queryKeys.ccrWorkspace.all()).toEqual(["ccr-workspace"])
        })

        it("when list is called, then returns list key", (): void => {
            expect(queryKeys.ccrWorkspace.list()).toEqual(["ccr-workspace", "list"])
        })

        it("when context is called with reviewId, then returns scoped key", (): void => {
            expect(queryKeys.ccrWorkspace.context("review-abc")).toEqual([
                "ccr-workspace",
                "context",
                "review-abc",
            ])
        })
    })

    describe("codeReview", (): void => {
        it("when all is called, then returns code-review key", (): void => {
            expect(queryKeys.codeReview.all()).toEqual(["code-review"])
        })

        it("when byId is called, then returns scoped key", (): void => {
            expect(queryKeys.codeReview.byId("rev-123")).toEqual([
                "code-review",
                "by-id",
                "rev-123",
            ])
        })
    })

    describe("gitProviders", (): void => {
        it("when all is called, then returns git-providers key", (): void => {
            expect(queryKeys.gitProviders.all()).toEqual(["git-providers"])
        })

        it("when list is called, then returns list key", (): void => {
            expect(queryKeys.gitProviders.list()).toEqual(["git-providers", "list"])
        })

        it("when byId is called, then returns scoped key", (): void => {
            expect(queryKeys.gitProviders.byId("github-1")).toEqual([
                "git-providers",
                "by-id",
                "github-1",
            ])
        })
    })

    describe("key uniqueness", (): void => {
        it("when different domains are queried, then keys do not collide", (): void => {
            const dryRunAll = queryKeys.dryRun.all()
            const repoConfigAll = queryKeys.repoConfig.all()
            const ccrSummaryAll = queryKeys.ccrSummary.all()

            expect(dryRunAll).not.toEqual(repoConfigAll)
            expect(dryRunAll).not.toEqual(ccrSummaryAll)
            expect(repoConfigAll).not.toEqual(ccrSummaryAll)
        })

        it("when same domain uses different selectors, then keys do not collide", (): void => {
            const all = queryKeys.gitProviders.all()
            const list = queryKeys.gitProviders.list()
            const byId = queryKeys.gitProviders.byId("x")

            expect(all).not.toEqual(list)
            expect(all).not.toEqual(byId)
            expect(list).not.toEqual(byId)
        })
    })
})
