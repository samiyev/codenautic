import type {ISuggestionDTO} from "../../dto/review/suggestion.dto"
import type {IGitProvider} from "../../ports/outbound/git/git-provider.port"
import type {ISystemSettingsProvider} from "../../ports/outbound/common/system-settings-provider.port"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {StageError} from "../../../domain/errors/stage.error"
import {Result} from "../../../shared/result"
import {
    INITIAL_STAGE_ATTEMPT,
    isPipelineCollectionItem,
    mergeExternalContext,
    readStringField,
} from "./pipeline-stage-state.utils"

const DEFAULT_BLOCKING_SEVERITIES = new Set(["CRITICAL", "HIGH"])
const BLOCKING_SEVERITIES_SETTINGS_KEY = "review.blocking_severities"

interface ISuggestionStringFields {
    readonly id: string
    readonly filePath: string
    readonly severity: string
    readonly category: string
    readonly message: string
}

interface ISuggestionMetaFields {
    readonly lineStart: number
    readonly lineEnd: number
    readonly committable: boolean
    readonly rankScore: number
}

/**
 * Constructor dependencies for request-changes-or-approve stage.
 */
export interface IRequestChangesOrApproveStageDependencies {
    gitProvider: IGitProvider
    systemSettingsProvider?: ISystemSettingsProvider
}

/**
 * Stage 17 use case. Decides whether to approve or request changes.
 */
export class RequestChangesOrApproveStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    private readonly gitProvider: IGitProvider
    private readonly systemSettingsProvider?: ISystemSettingsProvider

    /**
     * Creates request-changes-or-approve stage use case.
     *
     * @param dependencies Stage dependencies.
     */
    public constructor(dependencies: IRequestChangesOrApproveStageDependencies) {
        this.stageId = "request-changes-or-approve"
        this.stageName = "Request Changes Or Approve"
        this.gitProvider = dependencies.gitProvider
        this.systemSettingsProvider = dependencies.systemSettingsProvider
    }

    /**
     * Decides review outcome by severity thresholds and auto-approve setting.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition or stage error.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const mergeRequestId = readStringField(input.state.mergeRequest, "id")
        if (mergeRequestId === undefined) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Missing merge request id for review decision stage",
                    false,
                    new NotFoundError("MergeRequest", "id"),
                ),
            )
        }

        const suggestions = this.normalizeSuggestions(input.state.suggestions)
        const autoApprove = this.resolveAutoApprove(input.state.config)
        const blockingSeverities = await this.resolveBlockingSeverities()
        const blockingSuggestions = suggestions.filter((suggestion): boolean => {
            return blockingSeverities.has(suggestion.severity.trim().toUpperCase())
        })
        const decision = autoApprove && blockingSuggestions.length === 0 ? "approved" : "changes_requested"
        const decisionReason = this.resolveDecisionReason(autoApprove, blockingSuggestions.length)

        try {
            const decisionComment = await this.gitProvider.postComment(
                mergeRequestId,
                this.buildDecisionComment(decision, decisionReason, blockingSuggestions),
            )

            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    externalContext: mergeExternalContext(input.state.externalContext, {
                        reviewDecision: {
                            decision,
                            reason: decisionReason,
                            autoApprove,
                            blockingIssues: blockingSuggestions.length,
                            decisionCommentId: decisionComment.id,
                        },
                    }),
                }),
                metadata: {
                    checkpointHint: `review-decision:${decision}`,
                },
            })
        } catch (error: unknown) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Failed to publish review decision",
                    true,
                    error instanceof Error ? error : undefined,
                ),
            )
        }
    }

    /**
     * Resolves auto-approve boolean from config payload.
     *
     * @param config Config payload.
     * @returns Auto-approve flag.
     */
    private resolveAutoApprove(config: Readonly<Record<string, unknown>>): boolean {
        const rawValue = config["autoApprove"]
        if (typeof rawValue === "boolean") {
            return rawValue
        }

        if (typeof rawValue === "string") {
            const normalized = rawValue.trim().toLowerCase()
            if (normalized === "true") {
                return true
            }
            if (normalized === "false") {
                return false
            }
        }

        return false
    }

    /**
     * Resolves human-readable decision reason.
     *
     * @param autoApprove Auto-approve flag.
     * @param blockingCount Number of blocking suggestions.
     * @returns Decision reason text.
     */
    private resolveDecisionReason(autoApprove: boolean, blockingCount: number): string {
        if (blockingCount > 0) {
            return `Found ${blockingCount} blocking issues with HIGH/CRITICAL severity`
        }

        if (!autoApprove) {
            return "Auto-approve is disabled by configuration"
        }

        return "No blocking issues and auto-approve is enabled"
    }

    /**
     * Builds comment body for decision publication.
     *
     * @param decision Final decision.
     * @param reason Decision reason.
     * @param blockingSuggestions Blocking suggestions.
     * @returns Comment body.
     */
    private buildDecisionComment(
        decision: string,
        reason: string,
        blockingSuggestions: readonly ISuggestionDTO[],
    ): string {
        const lines = [`Review decision: ${decision}`, "", `Reason: ${reason}`]

        if (blockingSuggestions.length > 0) {
            lines.push("", "Blocking issues:")
            for (const suggestion of blockingSuggestions.slice(0, 10)) {
                lines.push(
                    `- [${suggestion.severity}] ${suggestion.message} (${suggestion.filePath}:${suggestion.lineStart})`,
                )
            }
        }

        return lines.join("\n")
    }

    /**
     * Resolves blocking severities from system settings.
     *
     * @returns Blocking severities set.
     */
    private async resolveBlockingSeverities(): Promise<Set<string>> {
        if (this.systemSettingsProvider === undefined) {
            return DEFAULT_BLOCKING_SEVERITIES
        }

        try {
            const payload = await this.systemSettingsProvider.get<unknown>(BLOCKING_SEVERITIES_SETTINGS_KEY)
            const parsed = this.parseBlockingSeverities(payload)
            if (parsed !== undefined) {
                return parsed
            }
        } catch {
            return DEFAULT_BLOCKING_SEVERITIES
        }

        return DEFAULT_BLOCKING_SEVERITIES
    }

    /**
     * Parses blocking severities payload.
     *
     * @param payload Raw payload.
     * @returns Set of severities or undefined.
     */
    private parseBlockingSeverities(payload: unknown): Set<string> | undefined {
        if (!Array.isArray(payload)) {
            return undefined
        }

        const normalized: string[] = []
        for (const entry of payload) {
            if (typeof entry !== "string") {
                return undefined
            }

            const value = entry.trim().toUpperCase()
            if (value.length === 0) {
                return undefined
            }

            normalized.push(value)
        }

        if (normalized.length === 0) {
            return undefined
        }

        return new Set(normalized)
    }

    /**
     * Normalizes raw suggestions payload to typed list.
     *
     * @param source Raw suggestions payload.
     * @returns Typed suggestion list.
     */
    private normalizeSuggestions(source: readonly unknown[]): ISuggestionDTO[] {
        const suggestions: ISuggestionDTO[] = []

        for (const item of source) {
            if (!isPipelineCollectionItem(item)) {
                continue
            }

            const suggestion = this.mapSuggestion(item)
            if (suggestion === null) {
                continue
            }

            suggestions.push(suggestion)
        }

        return suggestions
    }

    /**
     * Maps one raw suggestion payload to typed suggestion DTO.
     *
     * @param source Raw suggestion payload.
     * @returns Suggestion DTO or null.
     */
    private mapSuggestion(source: Readonly<Record<string, unknown>>): ISuggestionDTO | null {
        const stringFields = this.readSuggestionStringFields(source)
        if (stringFields === null) {
            return null
        }

        const metaFields = this.readSuggestionMetaFields(source)
        if (metaFields === null) {
            return null
        }

        return {
            id: stringFields.id,
            filePath: stringFields.filePath,
            lineStart: metaFields.lineStart,
            lineEnd: metaFields.lineEnd,
            severity: stringFields.severity,
            category: stringFields.category,
            message: stringFields.message,
            codeBlock: this.readCodeBlock(source),
            committable: metaFields.committable,
            rankScore: metaFields.rankScore,
        }
    }

    /**
     * Reads required suggestion string fields.
     *
     * @param source Raw suggestion payload.
     * @returns String fields or null.
     */
    private readSuggestionStringFields(
        source: Readonly<Record<string, unknown>>,
    ): ISuggestionStringFields | null {
        const id = readStringField(source, "id")
        const filePath = readStringField(source, "filePath")
        const severity = readStringField(source, "severity")
        const category = readStringField(source, "category")
        const message = readStringField(source, "message")
        if (
            id === undefined ||
            filePath === undefined ||
            severity === undefined ||
            category === undefined ||
            message === undefined
        ) {
            return null
        }

        return {
            id,
            filePath,
            severity,
            category,
            message,
        }
    }

    /**
     * Reads required suggestion numeric/boolean fields.
     *
     * @param source Raw suggestion payload.
     * @returns Metadata fields or null.
     */
    private readSuggestionMetaFields(source: Readonly<Record<string, unknown>>): ISuggestionMetaFields | null {
        const lineStart = source["lineStart"]
        const lineEnd = source["lineEnd"]
        const committable = source["committable"]
        const rankScore = source["rankScore"]
        if (
            typeof lineStart !== "number" ||
            typeof lineEnd !== "number" ||
            typeof committable !== "boolean" ||
            typeof rankScore !== "number"
        ) {
            return null
        }

        return {
            lineStart,
            lineEnd,
            committable,
            rankScore,
        }
    }

    /**
     * Reads optional code block from suggestion payload.
     *
     * @param source Raw suggestion payload.
     * @returns Trimmed code block when present.
     */
    private readCodeBlock(source: Readonly<Record<string, unknown>>): string | undefined {
        const rawCodeBlock = source["codeBlock"]
        if (typeof rawCodeBlock !== "string") {
            return undefined
        }

        const normalizedCodeBlock = rawCodeBlock.trim()
        if (normalizedCodeBlock.length === 0) {
            return undefined
        }

        return normalizedCodeBlock
    }

    /**
     * Creates normalized stage error payload.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Pinned definition version.
     * @param message Error message.
     * @param recoverable Recoverable flag.
     * @param originalError Optional wrapped error.
     * @returns Stage error.
     */
    private createStageError(
        runId: string,
        definitionVersion: string,
        message: string,
        recoverable: boolean,
        originalError?: Error,
    ): StageError {
        return new StageError({
            runId,
            definitionVersion,
            stageId: this.stageId,
            attempt: INITIAL_STAGE_ATTEMPT,
            recoverable,
            message,
            originalError,
        })
    }
}
