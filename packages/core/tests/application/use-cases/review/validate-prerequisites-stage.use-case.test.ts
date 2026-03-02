import {describe, expect, test} from "bun:test"

import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {ValidatePrerequisitesStageUseCase} from "../../../../src/application/use-cases/review/validate-prerequisites-stage.use-case"
import {UnauthorizedError} from "../../../../src/domain/errors/unauthorized.error"

interface IValidatePrerequisitesStagePrivateMethods {
    createPrerequisiteError(
        runId: string,
        definitionVersion: string,
        message: string,
        originalError?: Error,
    ): Error
}

/**
 * Creates baseline pipeline state for stage tests.
 *
 * @param mergeRequest Merge request payload.
 * @returns Pipeline state.
 */
function createState(mergeRequest: Readonly<Record<string, unknown>>): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-prerequisites",
        definitionVersion: "v1",
        mergeRequest,
        config: {},
    })
}

describe("ValidatePrerequisitesStageUseCase", () => {
    test("passes when all prerequisites are present", async () => {
        const useCase = new ValidatePrerequisitesStageUseCase()
        const state = createState({
            authToken: "token-1",
            organizationId: "org-1",
            teamId: "team-1",
            licenseActive: "true",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("prerequisites:validated")
        const prerequisites = result.value.state.externalContext?.[
            "prerequisites"
        ] as Readonly<Record<string, unknown>>
        expect(prerequisites["organizationId"]).toBe("org-1")
        expect(prerequisites["teamId"]).toBe("team-1")
        expect(prerequisites["hasAuthToken"]).toBe(true)
        expect(prerequisites["licenseActive"]).toBe(true)
    })

    test("fails with unauthorized error when auth token is missing", async () => {
        const useCase = new ValidatePrerequisitesStageUseCase()
        const state = createState({
            organizationId: "org-1",
            teamId: "team-1",
            licenseActive: true,
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.stageId).toBe("validate-prerequisites")
        expect(result.error.originalError?.name).toBe("UnauthorizedError")
    })

    test("fails with not found error when organization id is missing", async () => {
        const useCase = new ValidatePrerequisitesStageUseCase()
        const state = createState({
            authToken: "token-1",
            teamId: "team-1",
            licenseActive: true,
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.originalError?.name).toBe("NotFoundError")
    })

    test("fails with unauthorized error when license is inactive", async () => {
        const useCase = new ValidatePrerequisitesStageUseCase()
        const state = createState({
            authToken: "token-1",
            organizationId: "org-1",
            teamId: "team-1",
            licenseActive: false,
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.originalError?.name).toBe("UnauthorizedError")
        expect(result.error.message).toContain("license")
    })

    test("builds deterministic stage error via internal helper", () => {
        const useCase = new ValidatePrerequisitesStageUseCase()
        const stageError = (
            useCase as unknown as IValidatePrerequisitesStagePrivateMethods
        ).createPrerequisiteError(
            "run-private",
            "v1",
            "private-message",
            new UnauthorizedError("review:run"),
        )

        expect(stageError.name).toBe("StageError")
        expect(stageError.message).toContain("private-message")
    })
})
