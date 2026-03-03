import {describe, expect, test} from "bun:test"

import {FEEDBACK_TYPE} from "../../../src/domain/events/feedback-received"
import {IssueFeedback} from "../../../src/domain/value-objects/issue-feedback.value-object"
import {UniqueId} from "../../../src/domain/value-objects/unique-id.value-object"

describe("IssueFeedback", () => {
    test("creates feedback from raw strings", () => {
        const feedback = IssueFeedback.create({
            issueId: "issue-1",
            reviewId: "review-1",
            type: FEEDBACK_TYPE.HELPFUL,
            userId: "user-1",
            comment: " Works as expected ",
            createdAt: new Date("2025-01-01T00:00:00.000Z"),
        })

        expect(feedback.issueId.value).toBe("issue-1")
        expect(feedback.reviewId.value).toBe("review-1")
        expect(feedback.type).toBe(FEEDBACK_TYPE.HELPFUL)
        expect(feedback.userId.value).toBe("user-1")
        expect(feedback.comment).toBe("Works as expected")
        expect(feedback.createdAt.toISOString()).toBe("2025-01-01T00:00:00.000Z")
    })

    test("creates from value-object inputs", () => {
        const issueId = UniqueId.create("issue-2")
        const reviewId = UniqueId.create("review-2")
        const userId = UniqueId.create("user-2")

        const feedback = IssueFeedback.create({
            issueId,
            reviewId,
            type: FEEDBACK_TYPE.IMPLEMENTED,
            userId,
        })

        expect(feedback.issueId).toBe(issueId)
        expect(feedback.reviewId).toBe(reviewId)
        expect(feedback.userId).toBe(userId)
        expect(feedback.comment).toBeUndefined()
        expect(feedback.createdAt).toBeInstanceOf(Date)
    })

    test("normalizes empty comment to undefined", () => {
        const feedback = IssueFeedback.create({
            issueId: "issue-3",
            reviewId: "review-3",
            type: FEEDBACK_TYPE.ALREADY_KNOWN,
            userId: "user-3",
            comment: "   ",
        })

        expect(feedback.comment).toBeUndefined()
    })

    test("defaults createdAt when omitted", () => {
        const before = Date.now()
        const feedback = IssueFeedback.create({
            issueId: "issue-4",
            reviewId: "review-4",
            type: FEEDBACK_TYPE.DISMISSED,
            userId: "user-4",
        })
        const after = Date.now()

        expect(feedback.createdAt.getTime()).toBeGreaterThanOrEqual(before)
        expect(feedback.createdAt.getTime()).toBeLessThanOrEqual(after)
    })

    test("throws on invalid unique ids", () => {
        expect(() => {
            IssueFeedback.create({
                issueId: "issue-1",
                reviewId: "review-5",
                type: FEEDBACK_TYPE.HELPFUL,
                userId: " ",
            })
        }).toThrow(/UniqueId/)
    })
})
