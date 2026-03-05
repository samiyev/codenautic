import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IGeneratePromptInput} from "../use-cases/generate-prompt.use-case"
import type {
    IGetEnabledRulesInput,
    IGetEnabledRulesOutput,
} from "../dto/rules/get-enabled-rules.dto"
import type {ILibraryRuleRepository} from "../ports/outbound/rule/library-rule-repository.port"
import type {LibraryRule} from "../../domain/entities/library-rule.entity"
import type {ValidationError} from "../../domain/errors/validation.error"
import {RuleContextFormatterService} from "../../domain/services/rule-context-formatter.service"
import {Result} from "../../shared/result"

type IRuleContextFormatter = Pick<RuleContextFormatterService, "formatForPrompt">

/**
 * Prompt resolution failure reason.
 */
export type PromptResolutionFailureReason = "missing" | "empty" | "exception"

/**
 * Prompt resolution error.
 */
export class PromptResolutionError extends Error {
    public readonly reason: PromptResolutionFailureReason
    public readonly originalError?: Error

    /**
     * Creates prompt resolution error.
     *
     * @param reason Failure reason.
     * @param originalError Optional underlying error.
     */
    public constructor(reason: PromptResolutionFailureReason, originalError?: Error) {
        super(buildPromptResolutionMessage(reason))
        this.name = "PromptResolutionError"
        this.reason = reason
        this.originalError = originalError
    }
}

/**
 * Input for resolving system prompt via template use case.
 */
export interface IResolveSystemPromptInput {
    readonly generatePromptUseCase: IUseCase<IGeneratePromptInput, string, ValidationError>
    readonly promptName: string
    readonly organizationId?: string | null
    readonly runtimeVariables?: Record<string, unknown>
}

/**
 * Rule context resolution failure reason.
 */
export type RuleContextResolutionFailureReason = "enabled-rules" | "rules-load"

/**
 * Rule context resolution error.
 */
export class RuleContextResolutionError extends Error {
    public readonly reason: RuleContextResolutionFailureReason
    public readonly originalError?: Error

    /**
     * Creates rule context resolution error.
     *
     * @param reason Failure reason.
     * @param originalError Optional underlying error.
     */
    public constructor(reason: RuleContextResolutionFailureReason, originalError?: Error) {
        super(buildRuleContextResolutionMessage(reason))
        this.name = "RuleContextResolutionError"
        this.reason = reason
        this.originalError = originalError
    }
}

/**
 * Input for resolving prompt rule context payload.
 */
export interface IResolveRuleContextInput {
    readonly organizationId?: string | null
    readonly teamId?: string | null
    readonly globalRuleIds?: readonly string[]
    readonly organizationRuleIds?: readonly string[]
    readonly getEnabledRulesUseCase: IUseCase<IGetEnabledRulesInput, IGetEnabledRulesOutput, ValidationError>
    readonly libraryRuleRepository: ILibraryRuleRepository
    readonly ruleContextFormatterService: IRuleContextFormatter
}

/**
 * Resolves system prompt from prompt templates.
 *
 * @param input Resolution input.
 * @returns Prompt resolution result.
 */
export async function resolveSystemPrompt(
    input: IResolveSystemPromptInput,
): Promise<Result<string, PromptResolutionError>> {
    try {
        const result = await input.generatePromptUseCase.execute({
            name: input.promptName,
            organizationId: input.organizationId ?? null,
            runtimeVariables: input.runtimeVariables ?? {},
        })
        if (result.isFail) {
            return Result.fail<string, PromptResolutionError>(
                new PromptResolutionError("missing", result.error),
            )
        }

        const normalized = result.value.trim()
        if (normalized.length === 0) {
            return Result.fail<string, PromptResolutionError>(
                new PromptResolutionError("empty"),
            )
        }

        return Result.ok<string, PromptResolutionError>(normalized)
    } catch (error: unknown) {
        return Result.fail<string, PromptResolutionError>(
            new PromptResolutionError(
                "exception",
                error instanceof Error ? error : undefined,
            ),
        )
    }
}

/**
 * Resolves rules context payload for prompt injection.
 *
 * @param input Resolution input.
 * @returns Rule context payload or undefined.
 */
export async function resolveRuleContext(
    input: IResolveRuleContextInput,
): Promise<Result<string | undefined, RuleContextResolutionError>> {
    const organizationId = input.organizationId
    if (organizationId === undefined || organizationId === null) {
        return Result.ok<string | undefined, RuleContextResolutionError>(undefined)
    }

    try {
        const enabledRulesResult = await input.getEnabledRulesUseCase.execute({
            organizationId,
            globalRuleIds: input.globalRuleIds,
            organizationRuleIds: input.organizationRuleIds,
            teamId: input.teamId ?? undefined,
        })
        if (enabledRulesResult.isFail) {
            return Result.fail<string | undefined, RuleContextResolutionError>(
                new RuleContextResolutionError("enabled-rules", enabledRulesResult.error),
            )
        }

        const rules = await loadRulesByIds(
            input.libraryRuleRepository,
            enabledRulesResult.value.ruleIds,
        )
        if (rules.length === 0) {
            return Result.ok<string | undefined, RuleContextResolutionError>(undefined)
        }

        return Result.ok<string | undefined, RuleContextResolutionError>(
            input.ruleContextFormatterService.formatForPrompt(rules),
        )
    } catch (error: unknown) {
        return Result.fail<string | undefined, RuleContextResolutionError>(
            new RuleContextResolutionError(
                "rules-load",
                error instanceof Error ? error : undefined,
            ),
        )
    }
}

/**
 * Appends rules context payload into runtime variables.
 *
 * @param runtimeVariables Runtime variables for prompt rendering.
 * @param rulesContext Optional rules payload.
 * @returns Extended runtime variables.
 */
export function appendRuleContext(
    runtimeVariables: Readonly<Record<string, unknown>>,
    rulesContext: string | undefined,
): Record<string, unknown> {
    if (rulesContext === undefined) {
        return {
            ...runtimeVariables,
        }
    }

    return {
        ...runtimeVariables,
        rules: rulesContext,
    }
}

/**
 * Loads library rules by identifiers.
 *
 * @param repository Rule repository.
 * @param ruleIds Rule identifiers.
 * @returns Resolved rules list.
 */
async function loadRulesByIds(
    repository: ILibraryRuleRepository,
    ruleIds: readonly string[],
): Promise<readonly LibraryRule[]> {
    if (ruleIds.length === 0) {
        return []
    }

    const rules = await Promise.all(
        ruleIds.map(async (ruleId): Promise<LibraryRule | null> => {
            return repository.findByUuid(ruleId)
        }),
    )

    return rules.filter((rule): rule is LibraryRule => rule !== null)
}

/**
 * Builds prompt resolution error message.
 *
 * @param reason Resolution failure reason.
 * @returns Error message.
 */
function buildPromptResolutionMessage(reason: PromptResolutionFailureReason): string {
    switch (reason) {
        case "missing":
            return "Prompt template is missing"
        case "empty":
            return "Prompt template content is empty"
        case "exception":
            return "Prompt template resolution failed"
        default:
            return "Prompt template resolution failed"
    }
}

/**
 * Builds rule context resolution error message.
 *
 * @param reason Resolution failure reason.
 * @returns Error message.
 */
function buildRuleContextResolutionMessage(reason: RuleContextResolutionFailureReason): string {
    switch (reason) {
        case "enabled-rules":
            return "Enabled rules resolution failed"
        case "rules-load":
            return "Rule context resolution failed"
        default:
            return "Rule context resolution failed"
    }
}
