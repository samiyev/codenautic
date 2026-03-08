import {describe, expect, test} from "bun:test"

import {
    isPipelineCollectionItem,
    mergeExternalContext,
    readBooleanField,
    readObjectField,
    readReviewRuleSelectionConfig,
    readStringArrayField,
    readStringField,
    resolveCurrentHeadCommitId,
} from "../../../../src/application/use-cases/review/pipeline-stage-state.utils"

describe("pipeline-stage-state.utils", () => {
    test("readStringField returns trimmed value and handles invalid inputs", () => {
        expect(readStringField({field: "  value  "}, "field")).toBe("value")
        expect(readStringField({field: "   "}, "field")).toBeUndefined()
        expect(readStringField({field: 10}, "field")).toBeUndefined()
    })

    test("readBooleanField reads boolean and boolean-like strings", () => {
        expect(readBooleanField({flag: true}, "flag")).toBe(true)
        expect(readBooleanField({flag: "true"}, "flag")).toBe(true)
        expect(readBooleanField({flag: "false"}, "flag")).toBe(false)
        expect(readBooleanField({flag: "yes"}, "flag")).toBeUndefined()
    })

    test("readObjectField returns object-only values", () => {
        expect(readObjectField({ctx: {a: 1}}, "ctx")).toEqual({a: 1})
        expect(readObjectField({ctx: null}, "ctx")).toBeUndefined()
        expect(readObjectField({ctx: []}, "ctx")).toBeUndefined()
    })

    test("readStringArrayField returns trimmed array and rejects invalid values", () => {
        expect(readStringArrayField({ids: [" rule-1 ", "rule-2"]}, "ids")).toEqual([
            "rule-1",
            "rule-2",
        ])
        expect(readStringArrayField({ids: ["rule-1", "   "]}, "ids")).toBeUndefined()
        expect(readStringArrayField({ids: "rule-1"}, "ids")).toBeUndefined()
    })

    test("readReviewRuleSelectionConfig returns only valid rule-selection fields", () => {
        expect(
            readReviewRuleSelectionConfig({
                globalRuleIds: [" global-1 "],
                organizationRuleIds: [" org-1 ", "org-2"],
            }),
        ).toEqual({
            globalRuleIds: ["global-1"],
            organizationRuleIds: ["org-1", "org-2"],
        })
        expect(
            readReviewRuleSelectionConfig({
                globalRuleIds: ["global-1", ""],
                organizationRuleIds: "org-1",
            }),
        ).toEqual({})
    })

    test("resolveCurrentHeadCommitId prioritizes explicit head and fallback commits", () => {
        expect(
            resolveCurrentHeadCommitId({
                currentHeadCommitId: "head-explicit",
                commits: [{id: "older"}, {id: "newer"}],
            }),
        ).toBe("head-explicit")
        expect(
            resolveCurrentHeadCommitId({
                commits: [{id: "older"}, {id: "newer"}],
            }),
        ).toBe("newer")
        expect(
            resolveCurrentHeadCommitId({
                commits: [{id: " "}, {sha: "missing-id"}],
            }),
        ).toBeUndefined()
    })

    test("mergeExternalContext merges null and existing context deterministically", () => {
        expect(mergeExternalContext(null, {a: 1})).toEqual({a: 1})
        expect(mergeExternalContext({a: 1}, {b: 2})).toEqual({a: 1, b: 2})
    })

    test("isPipelineCollectionItem validates object shape", () => {
        expect(isPipelineCollectionItem({id: "x"})).toBe(true)
        expect(isPipelineCollectionItem(null)).toBe(false)
        expect(isPipelineCollectionItem([])).toBe(false)
    })
})
