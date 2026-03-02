import {describe, expect, test} from "bun:test"

import {StageError} from "../../../src/domain/errors/stage.error"

describe("StageError", () => {
    test("serializes full pipeline metadata", () => {
        const cause = new Error("provider timeout")
        const error = new StageError({
            runId: "run-42",
            definitionVersion: "v2",
            stageId: "fetch-diff",
            attempt: 3,
            recoverable: true,
            message: "Failed to fetch diff",
            originalError: cause,
        })

        const serialized = error.serialize()

        expect(serialized.code).toBe("STAGE_ERROR")
        expect(serialized.runId).toBe("run-42")
        expect(serialized.definitionVersion).toBe("v2")
        expect(serialized.stageId).toBe("fetch-diff")
        expect(serialized.attempt).toBe(3)
        expect(serialized.recoverable).toBe(true)
        expect(serialized.cause).toBe("provider timeout")
    })

    test("validates constructor parameters", () => {
        expect(() => {
            new StageError({
                runId: "run-1",
                definitionVersion: "v1",
                stageId: "stage-1",
                attempt: 0,
                recoverable: false,
                message: "invalid attempt",
            })
        }).toThrow("attempt must be an integer greater than or equal to one")

        expect(() => {
            new StageError({
                runId: " ",
                definitionVersion: "v1",
                stageId: "stage-1",
                attempt: 1,
                recoverable: false,
                message: "invalid run id",
            })
        }).toThrow("runId must be a non-empty string")
    })
})
