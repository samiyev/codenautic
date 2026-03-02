import {describe, expect, test} from "bun:test"

import type {IDiscardedSuggestionDTO} from "../../../../src/application/dto/review/discarded-suggestion.dto"
import type {ISuggestionDTO} from "../../../../src/application/dto/review/suggestion.dto"

describe("Suggestion DTOs", () => {
    test("supports suggestion payload shape", () => {
        const suggestion: ISuggestionDTO = {
            id: "s-1",
            filePath: "src/review.ts",
            lineStart: 10,
            lineEnd: 12,
            severity: "HIGH",
            category: "SECURITY",
            message: "Validate user input",
            codeBlock: "if (input === null) { return }",
            committable: true,
            rankScore: 90,
        }

        expect(suggestion.id).toBe("s-1")
        expect(suggestion.committable).toBe(true)
        expect(suggestion.rankScore).toBe(90)
    })

    test("supports discarded suggestion payload extending suggestion", () => {
        const discarded: IDiscardedSuggestionDTO = {
            id: "d-1",
            filePath: "src/legacy.ts",
            lineStart: 20,
            lineEnd: 20,
            severity: "LOW",
            category: "STYLE",
            message: "Minor formatting issue",
            committable: false,
            rankScore: 10,
            discardReason: "below-threshold",
            filterName: "severity-threshold",
        }

        expect(discarded.filterName).toBe("severity-threshold")
        expect(discarded.discardReason).toBe("below-threshold")
        expect(discarded.committable).toBe(false)
    })
})
