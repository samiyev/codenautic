import {describe, expect, test} from "bun:test"

import {FEEDBACK_TYPE, FeedbackReceived} from "../../../src/domain/events/feedback-received"
import {IssueFound} from "../../../src/domain/events/issue-found"
import {MetricsCalculated} from "../../../src/domain/events/metrics-calculated"
import {ScanStarted} from "../../../src/domain/events/scan-started"
import {ScanCompleted} from "../../../src/domain/events/scan-completed"
import {ScanFailed, SCAN_PHASE} from "../../../src/domain/events/scan-failed"
import {RepositoryIndexed} from "../../../src/domain/events/repository-indexed"
import {
    REVIEW_COMPLETION_STATUS,
    ReviewCompleted,
} from "../../../src/domain/events/review-completed"
import {ReviewStarted} from "../../../src/domain/events/review-started"

describe("review lifecycle events", () => {
    test("resolves ReviewStarted event name and payload", () => {
        const event = new ReviewStarted("review-1", {
            reviewId: "review-1",
            mergeRequestId: "mr-1",
            startedAt: "2026-03-03T10:00:00.000Z",
        })

        expect(event.eventName).toBe("ReviewStarted")
        expect(event.payload).toEqual({
            reviewId: "review-1",
            mergeRequestId: "mr-1",
            startedAt: "2026-03-03T10:00:00.000Z",
        })
    })

    test("resolves ReviewCompleted event name and payload", () => {
        const event = new ReviewCompleted("review-1", {
            reviewId: "review-1",
            status: REVIEW_COMPLETION_STATUS.COMPLETED,
            issueCount: 4,
            durationMs: 32000,
            consumedSeverity: 30,
            severityBudget: 50,
        })

        expect(event.eventName).toBe("ReviewCompleted")
        expect(event.payload).toEqual({
            reviewId: "review-1",
            status: "COMPLETED",
            issueCount: 4,
            durationMs: 32000,
            consumedSeverity: 30,
            severityBudget: 50,
        })
    })

    test("resolves IssueFound event name and payload", () => {
        const event = new IssueFound("review-1", {
            issueId: "issue-1",
            reviewId: "review-1",
            severity: "HIGH",
            filePath: "src/review.ts",
            lineRange: "L14-L16",
        })

        expect(event.eventName).toBe("IssueFound")
        expect(event.payload).toEqual({
            issueId: "issue-1",
            reviewId: "review-1",
            severity: "HIGH",
            filePath: "src/review.ts",
            lineRange: "L14-L16",
        })
    })

    test("resolves MetricsCalculated event name and payload", () => {
        const event = new MetricsCalculated("review-1", {
            reviewId: "review-1",
            tokenUsage: {
                inputTokens: 100,
                outputTokens: 50,
                totalTokens: 150,
            },
            costEstimate: 0.021,
            duration: 42000,
        })

        expect(event.eventName).toBe("MetricsCalculated")
        expect(event.payload).toEqual({
            reviewId: "review-1",
            tokenUsage: {
                inputTokens: 100,
                outputTokens: 50,
                totalTokens: 150,
            },
            costEstimate: 0.021,
            duration: 42000,
        })
    })

    test("resolves FeedbackReceived event name and payload", () => {
        const event = new FeedbackReceived("review-1", {
            issueId: "issue-1",
            reviewId: "review-1",
            feedbackType: FEEDBACK_TYPE.FALSE_POSITIVE,
            userId: "user-7",
        })

        expect(event.eventName).toBe("FeedbackReceived")
        expect(event.payload).toEqual({
            issueId: "issue-1",
            reviewId: "review-1",
            feedbackType: "FALSE_POSITIVE",
            userId: "user-7",
        })
    })

    test("resolves ScanStarted event name and payload", () => {
        const event = new ScanStarted("repo-1", {
            repositoryId: "repo-1",
            scanId: "scan-1",
            triggeredBy: "scheduler",
        })

        expect(event.eventName).toBe("ScanStarted")
        expect(event.payload).toEqual({
            repositoryId: "repo-1",
            scanId: "scan-1",
            triggeredBy: "scheduler",
        })
    })

    test("resolves ScanCompleted event name and payload", () => {
        const event = new ScanCompleted("repo-1", {
            repositoryId: "repo-1",
            scanId: "scan-1",
            totalFiles: 120,
            totalNodes: 460,
            duration: 15300,
        })

        expect(event.eventName).toBe("ScanCompleted")
        expect(event.payload).toEqual({
            repositoryId: "repo-1",
            scanId: "scan-1",
            totalFiles: 120,
            totalNodes: 460,
            duration: 15300,
        })
    })

    test("resolves ScanFailed event name and payload", () => {
        const event = new ScanFailed("repo-1", {
            repositoryId: "repo-1",
            scanId: "scan-1",
            errorMessage: "temporary git failure",
            phase: SCAN_PHASE.GRAPH_BUILDING,
        })

        expect(event.eventName).toBe("ScanFailed")
        expect(event.payload).toEqual({
            repositoryId: "repo-1",
            scanId: "scan-1",
            errorMessage: "temporary git failure",
            phase: "GRAPH_BUILDING",
        })
    })

    test("resolves RepositoryIndexed event name and payload", () => {
        const event = new RepositoryIndexed("repo-1", {
            repositoryId: "repo-1",
            totalFiles: 120,
            languages: ["ts", "tsx"],
        })

        expect(event.eventName).toBe("RepositoryIndexed")
        expect(event.payload).toEqual({
            repositoryId: "repo-1",
            totalFiles: 120,
            languages: ["ts", "tsx"],
        })
    })
})
