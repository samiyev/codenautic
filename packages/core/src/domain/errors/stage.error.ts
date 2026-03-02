import {DomainError} from "./domain.error"

/**
 * Stage error construction payload.
 */
export interface ICreateStageErrorParams {
    runId: string
    definitionVersion: string
    stageId: string
    attempt: number
    recoverable: boolean
    message: string
    originalError?: Error
}

/**
 * Domain error for pipeline stage failures.
 */
export class StageError extends DomainError {
    public readonly code = "STAGE_ERROR"
    public readonly runId: string
    public readonly definitionVersion: string
    public readonly stageId: string
    public readonly attempt: number
    public readonly recoverable: boolean
    public readonly originalError?: Error

    /**
     * Creates stage error instance.
     *
     * @param params Stage error payload.
     */
    public constructor(params: ICreateStageErrorParams) {
        StageError.ensureNonEmptyString(params.runId, "runId")
        StageError.ensureNonEmptyString(params.definitionVersion, "definitionVersion")
        StageError.ensureNonEmptyString(params.stageId, "stageId")

        if (!Number.isInteger(params.attempt) || params.attempt < 1) {
            throw new Error("attempt must be an integer greater than or equal to one")
        }
        if (params.message.trim().length === 0) {
            throw new Error("message must be a non-empty string")
        }

        super(params.message, params.originalError)
        this.runId = params.runId
        this.definitionVersion = params.definitionVersion
        this.stageId = params.stageId
        this.attempt = params.attempt
        this.recoverable = params.recoverable
        this.originalError = params.originalError
    }

    /**
     * Serializes stage error into transport-safe shape.
     *
     * @returns Serializable stage error payload.
     */
    public serialize(): {
        readonly code: string
        readonly message: string
        readonly timestamp: Date
        readonly cause?: string
        readonly runId: string
        readonly definitionVersion: string
        readonly stageId: string
        readonly attempt: number
        readonly recoverable: boolean
    } {
        const basePayload = super.serialize()

        return {
            ...basePayload,
            runId: this.runId,
            definitionVersion: this.definitionVersion,
            stageId: this.stageId,
            attempt: this.attempt,
            recoverable: this.recoverable,
        }
    }

    /**
     * Validates non-empty string fields.
     *
     * @param value Value to validate.
     * @param fieldName Field label.
     * @throws Error When value is empty.
     */
    private static ensureNonEmptyString(value: string, fieldName: string): void {
        if (value.trim().length === 0) {
            throw new Error(`${fieldName} must be a non-empty string`)
        }
    }
}
