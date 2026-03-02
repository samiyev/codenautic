import {describe, expect, test} from "bun:test"

import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {ValidateConfigStageUseCase} from "../../../../src/application/use-cases/review/validate-config-stage.use-case"
import {ValidationError} from "../../../../src/domain/errors/validation.error"

interface IValidateConfigStagePrivateMethods {
    validateSeverityThreshold(value: unknown, fields: {field: string; message: string}[]): string | undefined
    validateRequiredString(
        value: unknown,
        fieldName: string,
        fields: {field: string; message: string}[],
    ): string | undefined
    validatePositiveInteger(
        value: unknown,
        fieldName: string,
        fields: {field: string; message: string}[],
    ): number | undefined
    validateStringArray(
        value: unknown,
        fieldName: string,
        fields: {field: string; message: string}[],
    ): readonly string[] | undefined
    validatePromptOverrides(
        value: unknown,
        fields: {field: string; message: string}[],
    ): Record<string, unknown> | undefined
    validateOptionalString(
        value: unknown,
        fieldName: string,
        fields: {field: string; message: string}[],
    ): string | undefined
    createStageError(
        runId: string,
        definitionVersion: string,
        message: string,
        recoverable: boolean,
        originalError?: Error,
    ): Error
}

/**
 * Creates baseline state for validate-config stage tests.
 *
 * @param config Config payload.
 * @returns Pipeline state.
 */
function createState(config: Readonly<Record<string, unknown>>): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-validate-config",
        definitionVersion: "v1",
        mergeRequest: {},
        config,
    })
}

describe("ValidateConfigStageUseCase", () => {
    test("normalizes valid config payload", async () => {
        const useCase = new ValidateConfigStageUseCase()
        const state = createState({
            severityThreshold: "high",
            ignorePaths: [" src/generated/** ", "dist/**"],
            maxSuggestionsPerFile: 7,
            maxSuggestionsPerCCR: 25,
            cadence: " balanced ",
            customRuleIds: [" rule-1 ", "rule-2"],
            promptOverrides: {
                systemPrompt: " system ",
            },
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("config:validated")
        expect(result.value.state.config).toEqual({
            severityThreshold: "HIGH",
            ignorePaths: ["src/generated/**", "dist/**"],
            maxSuggestionsPerFile: 7,
            maxSuggestionsPerCCR: 25,
            cadence: "balanced",
            customRuleIds: ["rule-1", "rule-2"],
            promptOverrides: {
                systemPrompt: "system",
            },
        })
    })

    test("fails with validation error when required fields are invalid", async () => {
        const useCase = new ValidateConfigStageUseCase()
        const state = createState({
            severityThreshold: "warning",
            ignorePaths: "dist/**",
            maxSuggestionsPerFile: 0,
            maxSuggestionsPerCCR: -1,
            cadence: "",
            customRuleIds: [""],
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.originalError?.name).toBe("ValidationError")
        expect(result.error.message).toContain("invalid")
    })

    test("fails when prompt overrides shape is invalid", async () => {
        const useCase = new ValidateConfigStageUseCase()
        const state = createState({
            severityThreshold: "LOW",
            ignorePaths: [],
            maxSuggestionsPerFile: 2,
            maxSuggestionsPerCCR: 10,
            cadence: "standard",
            customRuleIds: [],
            promptOverrides: {
                summaryPrompt: "",
            },
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.originalError?.name).toBe("ValidationError")
    })

    test("covers private validators for deterministic schema checks", () => {
        const useCase = new ValidateConfigStageUseCase()
        const fields: {field: string; message: string}[] = []
        const privateMethods = useCase as unknown as IValidateConfigStagePrivateMethods

        expect(privateMethods.validateSeverityThreshold("medium", fields)).toBe("MEDIUM")
        expect(privateMethods.validateRequiredString(" value ", "cadence", fields)).toBe("value")
        expect(privateMethods.validatePositiveInteger(2, "maxSuggestionsPerFile", fields)).toBe(2)
        expect(privateMethods.validateStringArray([" a ", "b"], "ignorePaths", fields)).toEqual([
            "a",
            "b",
        ])
        expect(privateMethods.validatePromptOverrides(undefined, fields)).toBeUndefined()
        expect(privateMethods.validateOptionalString(undefined, "optional", fields)).toBeUndefined()

        const stageError = privateMethods.createStageError(
            "run-private",
            "v1",
            "config-private-error",
            false,
            new ValidationError("config invalid", []),
        )

        expect(stageError.name).toBe("StageError")
        expect(stageError.message).toContain("config-private-error")
    })
})
