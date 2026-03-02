import {describe, expect, test} from "bun:test"

import type {
    IReviewIssueDTO,
    IReviewResultDTO,
    IReviewResultMetricsDTO,
} from "../../../../src/application/dto/review/review-result.dto"

describe("IReviewResultDTO", () => {
    test("supports completed review result with issues and metrics", () => {
        const metrics: IReviewResultMetricsDTO = {
            duration: 45000,
        }

        const issue: IReviewIssueDTO = {
            id: "issue-1",
            filePath: "src/review.ts",
            lineStart: 15,
            lineEnd: 17,
            severity: "HIGH",
            category: "SECURITY",
            message: "Unescaped interpolation",
            suggestion: "Escape user-controlled data",
            rankScore: 90,
        }

        const result: IReviewResultDTO = {
            reviewId: "review-1",
            status: "COMPLETED",
            issues: [issue],
            metrics,
        }

        expect(result.reviewId).toBe("review-1")
        expect(result.status).toBe("COMPLETED")
        expect(result.issues).toHaveLength(1)
        expect(result.metrics?.duration).toBe(45000)
    })

    test("supports failed review result without metrics", () => {
        const result: IReviewResultDTO = {
            reviewId: "review-2",
            status: "FAILED",
            issues: [],
            metrics: null,
        }

        expect(result.status).toBe("FAILED")
        expect(result.metrics).toBeNull()
    })
})
