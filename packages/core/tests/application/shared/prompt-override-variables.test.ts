import {describe, expect, test} from "bun:test"

import {
    mapOverridesToVariables,
    OVERRIDE_VARIABLE_MAP,
    type ReviewOverrideVariable,
} from "../../../src/application/shared/prompt-override-variables"

const overrides = {
    categories: {
        descriptions: {
            bug: "bug text",
            performance: "perf text",
            security: "sec text",
        },
    },
    severity: {
        flags: {
            critical: "critical text",
            high: "high text",
            medium: "medium text",
            low: "low text",
        },
    },
    generation: {
        main: "main generation",
    },
}

const ALL_VARIABLES: readonly ReviewOverrideVariable[] = [
    "bugText",
    "perfText",
    "secText",
    "criticalText",
    "highText",
    "mediumText",
    "lowText",
    "mainGenText",
]

describe("prompt override variables", () => {
    test("maps all override variables", () => {
        const result = mapOverridesToVariables(overrides, ALL_VARIABLES)

        expect(result).toEqual({
            bugText: "bug text",
            perfText: "perf text",
            secText: "sec text",
            criticalText: "critical text",
            highText: "high text",
            mediumText: "medium text",
            lowText: "low text",
            mainGenText: "main generation",
        })
    })

    test("maps only selected variables", () => {
        const result = mapOverridesToVariables(overrides, ["criticalText", "mainGenText"])

        expect(result).toEqual({
            criticalText: "critical text",
            mainGenText: "main generation",
        })
    })

    test("resolves category description variables", () => {
        expect(OVERRIDE_VARIABLE_MAP.bugText(overrides)).toBe("bug text")
        expect(OVERRIDE_VARIABLE_MAP.perfText(overrides)).toBe("perf text")
        expect(OVERRIDE_VARIABLE_MAP.secText(overrides)).toBe("sec text")
    })

    test("resolves severity and generation variables", () => {
        expect(OVERRIDE_VARIABLE_MAP.criticalText(overrides)).toBe("critical text")
        expect(OVERRIDE_VARIABLE_MAP.highText(overrides)).toBe("high text")
        expect(OVERRIDE_VARIABLE_MAP.mediumText(overrides)).toBe("medium text")
        expect(OVERRIDE_VARIABLE_MAP.lowText(overrides)).toBe("low text")
        expect(OVERRIDE_VARIABLE_MAP.mainGenText(overrides)).toBe("main generation")
    })
})
