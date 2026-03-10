import { describe, expect, it } from "vitest"

import { validateScanProgressSearch } from "@/routes/scan-progress"

describe("validateScanProgressSearch", (): void => {
    it("when all params provided, then returns parsed search", (): void => {
        const result = validateScanProgressSearch({
            jobId: "scan-123",
            repositoryId: "org/repo",
            targetRepositories: ["repo-a", "repo-b"],
            source: "onboarding",
        })

        expect(result).toEqual({
            jobId: "scan-123",
            repositoryId: "org/repo",
            targetRepositories: ["repo-a", "repo-b"],
            source: "onboarding",
        })
    })

    it("when no params provided, then returns all undefined", (): void => {
        const result = validateScanProgressSearch({})

        expect(result).toEqual({
            jobId: undefined,
            repositoryId: undefined,
            targetRepositories: undefined,
            source: undefined,
        })
    })

    it("when jobId is whitespace, then returns undefined", (): void => {
        const result = validateScanProgressSearch({ jobId: "   " })

        expect(result.jobId).toBeUndefined()
    })

    it("when jobId has leading/trailing whitespace, then trims it", (): void => {
        const result = validateScanProgressSearch({ jobId: "  scan-456  " })

        expect(result.jobId).toBe("scan-456")
    })

    it("when repositoryId is empty string, then returns undefined", (): void => {
        const result = validateScanProgressSearch({ repositoryId: "" })

        expect(result.repositoryId).toBeUndefined()
    })

    it("when source is not 'onboarding', then returns undefined", (): void => {
        const result = validateScanProgressSearch({ source: "other" })

        expect(result.source).toBeUndefined()
    })

    it("when targetRepositories is a single string, then wraps in array", (): void => {
        const result = validateScanProgressSearch({
            targetRepositories: "single-repo",
        })

        expect(result.targetRepositories).toEqual(["single-repo"])
    })

    it("when targetRepositories contains empty strings, then filters them", (): void => {
        const result = validateScanProgressSearch({
            targetRepositories: ["repo-a", "", "  ", "repo-b"],
        })

        expect(result.targetRepositories).toEqual(["repo-a", "repo-b"])
    })

    it("when targetRepositories contains non-string values, then filters them", (): void => {
        const result = validateScanProgressSearch({
            targetRepositories: ["repo-a", 42, null, "repo-b"],
        })

        expect(result.targetRepositories).toEqual(["repo-a", "repo-b"])
    })

    it("when targetRepositories is all empty/invalid, then returns undefined", (): void => {
        const result = validateScanProgressSearch({
            targetRepositories: ["", "  ", ""],
        })

        expect(result.targetRepositories).toBeUndefined()
    })

    it("when jobId is non-string, then returns undefined", (): void => {
        const result = validateScanProgressSearch({ jobId: 123 })

        expect(result.jobId).toBeUndefined()
    })

    it("when repositoryId is non-string, then returns undefined", (): void => {
        const result = validateScanProgressSearch({ repositoryId: true })

        expect(result.repositoryId).toBeUndefined()
    })
})
