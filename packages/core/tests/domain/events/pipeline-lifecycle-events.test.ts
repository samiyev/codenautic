import {describe, expect, test} from "bun:test"

import {PipelineCompleted} from "../../../src/domain/events/pipeline-completed"
import {PipelineFailed} from "../../../src/domain/events/pipeline-failed"
import {PipelineStarted} from "../../../src/domain/events/pipeline-started"
import {StageCompleted} from "../../../src/domain/events/stage-completed"
import {StageFailed} from "../../../src/domain/events/stage-failed"
import {StageStarted} from "../../../src/domain/events/stage-started"

describe("pipeline lifecycle events", () => {
    test("resolves PipelineStarted event name and payload", () => {
        const event = new PipelineStarted("review-1", {
            runId: "run-1",
            definitionVersion: "v1",
            startedStageId: "stage-1",
        })

        expect(event.eventName).toBe("PipelineStarted")
        expect(event.payload).toEqual({
            runId: "run-1",
            definitionVersion: "v1",
            startedStageId: "stage-1",
        })
    })

    test("resolves StageStarted event name and payload", () => {
        const event = new StageStarted("review-1", {
            runId: "run-1",
            definitionVersion: "v1",
            stageId: "stage-1",
            attempt: 1,
        })

        expect(event.eventName).toBe("StageStarted")
        expect(event.payload).toEqual({
            runId: "run-1",
            definitionVersion: "v1",
            stageId: "stage-1",
            attempt: 1,
        })
    })

    test("resolves StageCompleted event name and payload", () => {
        const event = new StageCompleted("review-1", {
            runId: "run-1",
            definitionVersion: "v1",
            stageId: "stage-1",
            attempt: 1,
            durationMs: 20,
        })

        expect(event.eventName).toBe("StageCompleted")
        expect(event.payload).toEqual({
            runId: "run-1",
            definitionVersion: "v1",
            stageId: "stage-1",
            attempt: 1,
            durationMs: 20,
        })
    })

    test("resolves StageFailed event name and payload", () => {
        const event = new StageFailed("review-1", {
            runId: "run-1",
            definitionVersion: "v1",
            stageId: "stage-1",
            attempt: 2,
            recoverable: true,
            errorCode: "STAGE_ERROR",
        })

        expect(event.eventName).toBe("StageFailed")
        expect(event.payload).toEqual({
            runId: "run-1",
            definitionVersion: "v1",
            stageId: "stage-1",
            attempt: 2,
            recoverable: true,
            errorCode: "STAGE_ERROR",
        })
    })

    test("resolves PipelineCompleted event name and payload", () => {
        const event = new PipelineCompleted("review-1", {
            runId: "run-1",
            definitionVersion: "v1",
            totalDurationMs: 400,
            stageCount: 6,
        })

        expect(event.eventName).toBe("PipelineCompleted")
        expect(event.payload).toEqual({
            runId: "run-1",
            definitionVersion: "v1",
            totalDurationMs: 400,
            stageCount: 6,
        })
    })

    test("resolves PipelineFailed event name and payload", () => {
        const event = new PipelineFailed("review-1", {
            runId: "run-1",
            definitionVersion: "v1",
            failedStageId: "stage-3",
            terminal: false,
            reason: "retry exhausted",
        })

        expect(event.eventName).toBe("PipelineFailed")
        expect(event.payload).toEqual({
            runId: "run-1",
            definitionVersion: "v1",
            failedStageId: "stage-3",
            terminal: false,
            reason: "retry exhausted",
        })
    })
})
