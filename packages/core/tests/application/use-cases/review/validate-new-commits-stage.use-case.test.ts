import {describe, expect, test} from "bun:test"

import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {ValidateNewCommitsStageUseCase} from "../../../../src/application/use-cases/review/validate-new-commits-stage.use-case"
import {ValidationError} from "../../../../src/domain/errors/validation.error"

interface IValidateNewCommitsStagePrivateMethods {
    createValidationFailure(
        runId: string,
        definitionVersion: string,
        fields: readonly {field: string; message: string}[],
    ): Error
    createStageError(
        runId: string,
        definitionVersion: string,
        message: string,
        recoverable: boolean,
        originalError?: Error,
    ): Error
}

/**
 * Creates baseline state for commit validation tests.
 *
 * @param mergeRequest Merge request payload.
 * @returns Pipeline state.
 */
function createState(mergeRequest: Readonly<Record<string, unknown>>): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-commits",
        definitionVersion: "v1",
        mergeRequest,
        config: {},
        files: [{path: "src/a.ts"}],
        suggestions: [{id: "s-1"}],
        discardedSuggestions: [{id: "d-1"}],
        externalContext: {existing: true},
    })
}

describe("ValidateNewCommitsStageUseCase", () => {
    test("stores commit validation context when new commits are detected", async () => {
        const useCase = new ValidateNewCommitsStageUseCase()
        const state = createState({
            currentHeadCommitId: "head-2",
            lastReviewedCommitId: "head-1",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("new-commits:detected")
        const commitValidation = result.value.state.externalContext?.[
            "commitValidation"
        ] as Readonly<Record<string, unknown>>
        expect(commitValidation["hasNewCommits"]).toBe(true)
        expect(commitValidation["currentHeadCommitId"]).toBe("head-2")
        expect(commitValidation["lastReviewedCommitId"]).toBe("head-1")
    })

    test("returns skip transition with empty context when commits are unchanged", async () => {
        const useCase = new ValidateNewCommitsStageUseCase()
        const state = createState({
            currentHeadCommitId: "head-2",
            lastReviewedCommitId: "head-2",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("skip:no-new-commits")
        expect(result.value.state.files).toHaveLength(0)
        expect(result.value.state.suggestions).toHaveLength(0)
        expect(result.value.state.discardedSuggestions).toHaveLength(0)
        expect(result.value.state.externalContext).toBe(null)
    })

    test("resolves current head commit from commits tail when explicit head is absent", async () => {
        const useCase = new ValidateNewCommitsStageUseCase()
        const state = createState({
            commits: [{id: "head-1"}, {id: "head-3"}],
            lastReviewedCommitId: "head-2",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        const commitValidation = result.value.state.externalContext?.[
            "commitValidation"
        ] as Readonly<Record<string, unknown>>
        expect(commitValidation["currentHeadCommitId"]).toBe("head-3")
    })

    test("fails when current head commit cannot be resolved", async () => {
        const useCase = new ValidateNewCommitsStageUseCase()
        const state = createState({
            lastReviewedCommitId: "head-2",
            commits: [],
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.originalError?.name).toBe("ValidationError")
        expect(result.error.message).toContain("commit metadata validation")
    })

    test("builds internal stage errors for validation and runtime branches", () => {
        const useCase = new ValidateNewCommitsStageUseCase()
        const privateMethods = useCase as unknown as IValidateNewCommitsStagePrivateMethods
        const validationFailure = privateMethods.createValidationFailure("run-private", "v1", [
            {
                field: "mergeRequest.currentHeadCommitId",
                message: "missing",
            },
        ])
        const stageFailure = privateMethods.createStageError(
            "run-private",
            "v1",
            "runtime failure",
            true,
            new ValidationError("invalid", []),
        )

        expect(validationFailure.name).toBe("StageError")
        expect(stageFailure.name).toBe("StageError")
        expect(stageFailure.message).toContain("runtime failure")
    })
})
