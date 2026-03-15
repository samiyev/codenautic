import {
    MESSAGE_ROLE,
    type IChatRequestDTO,
    type IChatResponseDTO,
    type IChatResponseFormatDTO,
    type ILLMProvider,
    type IMessageDTO,
    type IToolDefinitionDTO,
} from "@codenautic/core"

import {
    LLM_CHAIN_BUILDER_ERROR_CODE,
    LlmChainBuilderError,
} from "./llm-chain-builder.error"
import type {IPromptTemplateManager} from "./prompt-template-manager"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 60_000

/**
 * One review-chain step definition.
 */
export interface ILlmChainStepDefinition {
    /**
     * Stable step name.
     */
    readonly name: string

    /**
     * Prompt template name rendered for this step.
     */
    readonly templateName: string

    /**
     * Optional per-step model override.
     */
    readonly model?: string

    /**
     * Optional per-step temperature override.
     */
    readonly temperature?: number

    /**
     * Optional per-step max tokens override.
     */
    readonly maxTokens?: number

    /**
     * Optional per-step tools payload.
     */
    readonly tools?: readonly IToolDefinitionDTO[]

    /**
     * Optional per-step response format override.
     */
    readonly responseFormat?: IChatResponseFormatDTO

    /**
     * Optional variable name where response text will be stored.
     */
    readonly outputVariableName?: string

    /**
     * Optional max attempts override for retry policy.
     */
    readonly maxAttempts?: number

    /**
     * Optional retry backoff (milliseconds) override.
     */
    readonly retryBackoffMs?: number
}

/**
 * One review-chain definition.
 */
export interface ILlmChainDefinition {
    /**
     * Stable chain name.
     */
    readonly name: string

    /**
     * Optional system prompt template rendered before every step.
     */
    readonly systemTemplateName?: string

    /**
     * Ordered step list.
     */
    readonly steps: readonly ILlmChainStepDefinition[]
}

/**
 * Input payload for LLM chain execution.
 */
export interface ILlmChainExecutionInput {
    /**
     * Chain name to execute.
     */
    readonly chainName: string

    /**
     * Runtime variable values for prompt rendering.
     */
    readonly runtimeVariables?: Readonly<Record<string, unknown>>

    /**
     * Optional idempotency key for in-flight dedupe and cache lookup.
     */
    readonly idempotencyKey?: string

    /**
     * Optional model override for all steps without model.
     */
    readonly model?: string
}

/**
 * One executed chain-step result.
 */
export interface ILlmChainStepResult {
    /**
     * Step name.
     */
    readonly stepName: string

    /**
     * Template name rendered for step.
     */
    readonly templateName: string

    /**
     * Rendered prompt text.
     */
    readonly prompt: string

    /**
     * Chat response payload from provider.
     */
    readonly response: IChatResponseDTO

    /**
     * Number of attempts used for this step.
     */
    readonly attemptCount: number
}

/**
 * Final chain execution result.
 */
export interface ILlmChainExecutionResult {
    /**
     * Executed chain name.
     */
    readonly chainName: string

    /**
     * Last step response content.
     */
    readonly finalContent: string

    /**
     * Ordered per-step execution results.
     */
    readonly stepResults: readonly ILlmChainStepResult[]

    /**
     * Runtime variables after chain completion.
     */
    readonly runtimeVariables: Readonly<Record<string, unknown>>
}

/**
 * Runtime options for LLM chain builder.
 */
export interface ILlmChainBuilderOptions {
    /**
     * LLM provider used for step executions.
     */
    readonly provider: ILLMProvider

    /**
     * Prompt template manager used for prompt rendering.
     */
    readonly promptTemplateManager: IPromptTemplateManager

    /**
     * Default model for chain execution.
     */
    readonly defaultModel: string

    /**
     * Default max attempts for step retry.
     */
    readonly defaultMaxAttempts?: number

    /**
     * Default retry backoff (milliseconds).
     */
    readonly defaultRetryBackoffMs?: number

    /**
     * Idempotency cache TTL in milliseconds.
     */
    readonly idempotencyTtlMs?: number

    /**
     * Optional sleep implementation used by retry backoff.
     */
    readonly sleep?: (delayMs: number) => Promise<void>

    /**
     * Optional deterministic clock for idempotency TTL checks.
     */
    readonly now?: () => Date
}

/**
 * LLM chain builder contract.
 */
export interface ILlmChainBuilder {
    /**
     * Registers one chain definition.
     *
     * @param definition Chain definition.
     */
    registerChain(definition: ILlmChainDefinition): void

    /**
     * Removes chain by name.
     *
     * @param chainName Chain name.
     * @returns True when chain existed and was removed.
     */
    removeChain(chainName: string): boolean

    /**
     * Returns whether chain exists.
     *
     * @param chainName Chain name.
     * @returns True when chain exists.
     */
    hasChain(chainName: string): boolean

    /**
     * Lists registered chain definitions in stable name order.
     *
     * @returns Registered chains.
     */
    listChains(): readonly ILlmChainDefinition[]

    /**
     * Executes one registered chain.
     *
     * @param input Execution input.
     * @returns Chain execution result.
     */
    execute(input: ILlmChainExecutionInput): Promise<ILlmChainExecutionResult>
}

interface IResolvedLlmChainStepDefinition {
    readonly name: string
    readonly templateName: string
    readonly model?: string
    readonly temperature?: number
    readonly maxTokens?: number
    readonly tools?: readonly IToolDefinitionDTO[]
    readonly responseFormat?: IChatResponseFormatDTO
    readonly outputVariableName: string
    readonly maxAttempts: number
    readonly retryBackoffMs: number
}

interface IResolvedLlmChainDefinition {
    readonly name: string
    readonly systemTemplateName?: string
    readonly steps: readonly IResolvedLlmChainStepDefinition[]
}

interface IResolvedLlmChainExecutionInput {
    readonly chainName: string
    readonly runtimeVariables: Readonly<Record<string, unknown>>
    readonly idempotencyKey?: string
    readonly model?: string
}

interface ILlmChainCacheEntry {
    readonly expiresAtMs: number
    readonly result: ILlmChainExecutionResult
}

/**
 * Builds and executes deterministic review-oriented LLM chains.
 */
export class LlmChainBuilder implements ILlmChainBuilder {
    private readonly provider: ILLMProvider
    private readonly promptTemplateManager: IPromptTemplateManager
    private readonly defaultModel: string
    private readonly defaultMaxAttempts: number
    private readonly defaultRetryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly chains = new Map<string, IResolvedLlmChainDefinition>()
    private readonly inFlightExecutions = new Map<string, Promise<ILlmChainExecutionResult>>()
    private readonly idempotencyCache = new Map<string, ILlmChainCacheEntry>()

    /**
     * Creates LLM chain builder.
     *
     * @param options Builder options.
     */
    public constructor(options: ILlmChainBuilderOptions) {
        this.provider = validateProvider(options.provider)
        this.promptTemplateManager = validatePromptTemplateManager(
            options.promptTemplateManager,
        )
        this.defaultModel = normalizeModel(
            options.defaultModel,
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_MODEL,
        )
        this.defaultMaxAttempts = validatePositiveInteger(
            options.defaultMaxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_MAX_ATTEMPTS,
        )
        this.defaultRetryBackoffMs = validateNonNegativeInteger(
            options.defaultRetryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Registers one chain definition.
     *
     * @param definition Chain definition.
     */
    public registerChain(definition: ILlmChainDefinition): void {
        const normalized = this.normalizeChainDefinition(definition)

        if (this.chains.has(normalized.name)) {
            throw new LlmChainBuilderError(
                LLM_CHAIN_BUILDER_ERROR_CODE.CHAIN_ALREADY_EXISTS,
                {
                    chainName: normalized.name,
                },
            )
        }

        this.chains.set(normalized.name, normalized)
    }

    /**
     * Removes chain by name.
     *
     * @param chainName Chain name.
     * @returns True when chain existed and was removed.
     */
    public removeChain(chainName: string): boolean {
        const normalized = normalizeChainName(chainName)
        return this.chains.delete(normalized)
    }

    /**
     * Returns whether chain exists.
     *
     * @param chainName Chain name.
     * @returns True when chain exists.
     */
    public hasChain(chainName: string): boolean {
        const normalized = normalizeChainName(chainName)
        return this.chains.has(normalized)
    }

    /**
     * Lists registered chain definitions in stable name order.
     *
     * @returns Registered chains.
     */
    public listChains(): readonly ILlmChainDefinition[] {
        return [...this.chains.values()]
            .sort((left, right): number => left.name.localeCompare(right.name))
            .map((chain): ILlmChainDefinition => toPublicChainDefinition(chain))
    }

    /**
     * Executes one registered chain.
     *
     * @param input Execution input.
     * @returns Chain execution result.
     */
    public async execute(input: ILlmChainExecutionInput): Promise<ILlmChainExecutionResult> {
        const normalized = this.normalizeExecutionInput(input)
        const chain = this.requireChain(normalized.chainName)

        if (normalized.idempotencyKey === undefined) {
            return this.executeChain(chain, normalized)
        }

        const nowMs = this.now().getTime()
        this.evictExpiredCacheEntries(nowMs)

        const cacheKey = createExecutionCacheKey(normalized)
        const cached = this.idempotencyCache.get(cacheKey)
        if (cached !== undefined) {
            return cached.result
        }

        const inFlight = this.inFlightExecutions.get(cacheKey)
        if (inFlight !== undefined) {
            return inFlight
        }

        const executionPromise = this.executeChain(chain, normalized)
            .then((result): ILlmChainExecutionResult => {
                this.idempotencyCache.set(cacheKey, {
                    expiresAtMs: nowMs + this.idempotencyTtlMs,
                    result,
                })
                return result
            })
            .finally((): void => {
                this.inFlightExecutions.delete(cacheKey)
            })
        this.inFlightExecutions.set(cacheKey, executionPromise)
        return executionPromise
    }

    /**
     * Resolves and validates one registered chain by name.
     *
     * @param chainName Chain name.
     * @returns Registered resolved chain.
     */
    private requireChain(chainName: string): IResolvedLlmChainDefinition {
        const chain = this.chains.get(chainName)
        if (chain === undefined) {
            throw new LlmChainBuilderError(
                LLM_CHAIN_BUILDER_ERROR_CODE.CHAIN_NOT_FOUND,
                {
                    chainName,
                },
            )
        }
        return chain
    }

    /**
     * Executes one chain sequentially.
     *
     * @param chain Resolved chain definition.
     * @param input Normalized execution input.
     * @returns Chain execution result.
     */
    private async executeChain(
        chain: IResolvedLlmChainDefinition,
        input: IResolvedLlmChainExecutionInput,
    ): Promise<ILlmChainExecutionResult> {
        const runtimeVariables: Record<string, unknown> = {
            ...input.runtimeVariables,
        }
        const stepResults: ILlmChainStepResult[] = []
        const conversation: IMessageDTO[] = []

        for (const step of chain.steps) {
            const prompt = this.promptTemplateManager.renderTemplate(
                step.templateName,
                runtimeVariables,
            )
            const systemPrompt = this.resolveSystemPrompt(chain.systemTemplateName, runtimeVariables)
            const request = buildStepRequest(
                step.model ?? input.model ?? this.defaultModel,
                conversation,
                prompt,
                systemPrompt,
                step,
            )
            const stepExecution = await this.executeStepWithRetry(chain.name, step, request)

            conversation.push(
                {
                    role: MESSAGE_ROLE.USER,
                    content: prompt,
                },
                {
                    role: MESSAGE_ROLE.ASSISTANT,
                    content: stepExecution.response.content,
                },
            )
            runtimeVariables[step.outputVariableName] = stepExecution.response.content
            stepResults.push({
                stepName: step.name,
                templateName: step.templateName,
                prompt,
                response: stepExecution.response,
                attemptCount: stepExecution.attemptCount,
            })
        }

        const finalContent = stepResults.at(-1)?.response.content ?? ""
        return {
            chainName: chain.name,
            finalContent,
            stepResults,
            runtimeVariables,
        }
    }

    /**
     * Executes one chain step with bounded retry policy.
     *
     * @param chainName Parent chain name.
     * @param step Step definition.
     * @param request Step chat request.
     * @returns Step response and attempts count.
     */
    private async executeStepWithRetry(
        chainName: string,
        step: IResolvedLlmChainStepDefinition,
        request: IChatRequestDTO,
    ): Promise<{
        readonly response: IChatResponseDTO
        readonly attemptCount: number
    }> {
        for (let attempt = 1; attempt <= step.maxAttempts; attempt += 1) {
            try {
                const response = await this.provider.chat(request)
                return {
                    response,
                    attemptCount: attempt,
                }
            } catch (error) {
                if (attempt === step.maxAttempts) {
                    throw new LlmChainBuilderError(
                        LLM_CHAIN_BUILDER_ERROR_CODE.STEP_EXECUTION_FAILED,
                        {
                            chainName,
                            stepName: step.name,
                            templateName: step.templateName,
                            attempt,
                            causeMessage: resolveCauseMessage(error),
                        },
                    )
                }

                if (step.retryBackoffMs > 0) {
                    await this.sleep(step.retryBackoffMs)
                }
            }
        }

        throw new LlmChainBuilderError(
            LLM_CHAIN_BUILDER_ERROR_CODE.STEP_EXECUTION_FAILED,
            {
                chainName,
                stepName: step.name,
                templateName: step.templateName,
            },
        )
    }

    /**
     * Renders optional chain-level system prompt template.
     *
     * @param systemTemplateName Optional template name.
     * @param runtimeVariables Current runtime variables.
     * @returns Rendered system prompt or undefined.
     */
    private resolveSystemPrompt(
        systemTemplateName: string | undefined,
        runtimeVariables: Readonly<Record<string, unknown>>,
    ): string | undefined {
        if (systemTemplateName === undefined) {
            return undefined
        }
        return this.promptTemplateManager.renderTemplate(systemTemplateName, runtimeVariables)
    }

    /**
     * Validates and normalizes chain definition.
     *
     * @param definition Raw chain definition.
     * @returns Resolved chain definition.
     */
    private normalizeChainDefinition(
        definition: ILlmChainDefinition,
    ): IResolvedLlmChainDefinition {
        const chainName = normalizeChainName(definition.name)
        const systemTemplateName = normalizeOptionalTemplateName(definition.systemTemplateName)
        const steps = definition.steps

        if (steps.length === 0) {
            throw new LlmChainBuilderError(
                LLM_CHAIN_BUILDER_ERROR_CODE.EMPTY_CHAIN_STEPS,
                {
                    chainName,
                },
            )
        }

        const seenStepNames = new Set<string>()
        const normalizedSteps = steps.map((step): IResolvedLlmChainStepDefinition => {
            return this.normalizeStepDefinition(step, chainName, seenStepNames)
        })

        return {
            name: chainName,
            systemTemplateName,
            steps: normalizedSteps,
        }
    }

    /**
     * Validates and normalizes one step definition.
     *
     * @param step Raw step.
     * @param chainName Parent chain name.
     * @param seenStepNames Set of already used step names.
     * @returns Resolved step definition.
     */
    private normalizeStepDefinition(
        step: ILlmChainStepDefinition,
        chainName: string,
        seenStepNames: Set<string>,
    ): IResolvedLlmChainStepDefinition {
        const stepName = normalizeStepName(step.name, chainName)
        if (seenStepNames.has(stepName)) {
            throw new LlmChainBuilderError(
                LLM_CHAIN_BUILDER_ERROR_CODE.DUPLICATE_STEP_NAME,
                {
                    chainName,
                    stepName,
                },
            )
        }
        seenStepNames.add(stepName)

        const templateName = normalizeTemplateName(step.templateName, stepName)
        const outputVariableName = normalizeOutputVariableName(step.outputVariableName, stepName)
        const model =
            step.model === undefined
                ? undefined
                : normalizeModel(
                      step.model,
                      LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_MODEL,
                  )
        const maxAttempts = validatePositiveInteger(
            step.maxAttempts ?? this.defaultMaxAttempts,
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_MAX_ATTEMPTS,
            chainName,
            stepName,
        )
        const retryBackoffMs = validateNonNegativeInteger(
            step.retryBackoffMs ?? this.defaultRetryBackoffMs,
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_RETRY_BACKOFF_MS,
            chainName,
            stepName,
        )

        return {
            name: stepName,
            templateName,
            model,
            temperature: step.temperature,
            maxTokens: step.maxTokens,
            tools: step.tools,
            responseFormat: step.responseFormat,
            outputVariableName,
            maxAttempts,
            retryBackoffMs,
        }
    }

    /**
     * Validates and normalizes chain execution input.
     *
     * @param input Raw execution input.
     * @returns Resolved execution input.
     */
    private normalizeExecutionInput(
        input: ILlmChainExecutionInput,
    ): IResolvedLlmChainExecutionInput {
        const chainName = normalizeChainName(input.chainName)
        const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)
        const runtimeVariables = ensureRecord(input.runtimeVariables)
        const model =
            input.model === undefined
                ? undefined
                : normalizeModel(
                      input.model,
                      LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_DEFAULT_MODEL,
                  )

        return {
            chainName,
            runtimeVariables,
            idempotencyKey,
            model,
        }
    }

    /**
     * Removes expired idempotency cache entries.
     *
     * @param nowMs Current timestamp.
     */
    private evictExpiredCacheEntries(nowMs: number): void {
        for (const [cacheKey, entry] of this.idempotencyCache.entries()) {
            if (entry.expiresAtMs <= nowMs) {
                this.idempotencyCache.delete(cacheKey)
            }
        }
    }
}

/**
 * Validates LLM provider contract.
 *
 * @param provider Provider candidate.
 * @returns Validated provider.
 */
function validateProvider(provider: ILLMProvider): ILLMProvider {
    if (
        typeof provider.chat !== "function"
        || typeof provider.stream !== "function"
        || typeof provider.embed !== "function"
    ) {
        throw new LlmChainBuilderError(LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_PROVIDER)
    }
    return provider
}

/**
 * Validates prompt template manager contract.
 *
 * @param manager Prompt template manager candidate.
 * @returns Validated manager.
 */
function validatePromptTemplateManager(
    manager: IPromptTemplateManager,
): IPromptTemplateManager {
    if (typeof manager.renderTemplate !== "function") {
        throw new LlmChainBuilderError(
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_PROMPT_TEMPLATE_MANAGER,
        )
    }
    return manager
}

/**
 * Normalizes chain name.
 *
 * @param chainName Raw chain name.
 * @returns Normalized chain name.
 */
function normalizeChainName(chainName: string): string {
    const normalized = chainName.trim()
    if (normalized.length === 0) {
        throw new LlmChainBuilderError(LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_CHAIN_NAME, {
            chainName,
        })
    }
    return normalized
}

/**
 * Normalizes step name.
 *
 * @param stepName Raw step name.
 * @param chainName Parent chain name.
 * @returns Normalized step name.
 */
function normalizeStepName(stepName: string, chainName: string): string {
    const normalized = stepName.trim()
    if (normalized.length === 0) {
        throw new LlmChainBuilderError(LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_NAME, {
            chainName,
            stepName,
        })
    }
    return normalized
}

/**
 * Normalizes one template name.
 *
 * @param templateName Raw template name.
 * @param stepName Step name.
 * @returns Normalized template name.
 */
function normalizeTemplateName(templateName: string, stepName: string): string {
    const normalized = templateName.trim()
    if (normalized.length === 0) {
        throw new LlmChainBuilderError(
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_STEP_TEMPLATE_NAME,
            {
                stepName,
                templateName,
            },
        )
    }
    return normalized
}

/**
 * Normalizes optional system template name.
 *
 * @param templateName Optional template name.
 * @returns Normalized optional template name.
 */
function normalizeOptionalTemplateName(templateName?: string): string | undefined {
    if (templateName === undefined) {
        return undefined
    }
    const normalized = templateName.trim()
    if (normalized.length === 0) {
        return undefined
    }
    return normalized
}

/**
 * Normalizes optional output variable name.
 *
 * @param outputVariableName Optional output variable name.
 * @param stepName Step name.
 * @returns Normalized output variable name.
 */
function normalizeOutputVariableName(
    outputVariableName: string | undefined,
    stepName: string,
): string {
    if (outputVariableName === undefined) {
        return `${stepName}Response`
    }

    const normalized = outputVariableName.trim()
    if (normalized.length === 0) {
        return `${stepName}Response`
    }

    return normalized
}

/**
 * Normalizes model name.
 *
 * @param model Raw model.
 * @param code Error code for failed validation.
 * @returns Normalized model.
 */
function normalizeModel(
    model: string,
    code: LlmChainBuilderError["code"],
): string {
    const normalized = model.trim()
    if (normalized.length === 0) {
        throw new LlmChainBuilderError(code)
    }
    return normalized
}

/**
 * Validates positive integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @param chainName Optional chain name.
 * @param stepName Optional step name.
 * @returns Validated integer value.
 */
function validatePositiveInteger(
    value: number,
    code: LlmChainBuilderError["code"],
    chainName?: string,
    stepName?: string,
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new LlmChainBuilderError(code, {
            chainName,
            stepName,
        })
    }
    return value
}

/**
 * Validates non-negative integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @param chainName Optional chain name.
 * @param stepName Optional step name.
 * @returns Validated integer value.
 */
function validateNonNegativeInteger(
    value: number,
    code: LlmChainBuilderError["code"],
    chainName?: string,
    stepName?: string,
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new LlmChainBuilderError(code, {
            chainName,
            stepName,
        })
    }
    return value
}

/**
 * Ensures runtime variables value is plain object map.
 *
 * @param value Runtime variables candidate.
 * @returns Runtime variables object.
 */
function ensureRecord(
    value: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
    if (value === undefined) {
        return {}
    }
    return value
}

/**
 * Normalizes optional idempotency key.
 *
 * @param idempotencyKey Optional idempotency key.
 * @returns Normalized key or undefined.
 */
function normalizeOptionalIdempotencyKey(idempotencyKey?: string): string | undefined {
    if (idempotencyKey === undefined) {
        return undefined
    }
    const normalized = idempotencyKey.trim()
    if (normalized.length === 0) {
        throw new LlmChainBuilderError(
            LLM_CHAIN_BUILDER_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
            {
                idempotencyKey,
            },
        )
    }
    return normalized
}

/**
 * Creates deterministic execution cache key.
 *
 * @param input Normalized execution input.
 * @returns Cache key.
 */
function createExecutionCacheKey(input: IResolvedLlmChainExecutionInput): string {
    return [
        input.chainName,
        input.idempotencyKey ?? "",
        input.model ?? "",
        stableSerialize(input.runtimeVariables),
    ].join("|")
}

/**
 * Builds chat request for one chain step.
 *
 * @param model Resolved model name.
 * @param conversation Conversation history.
 * @param prompt Current user prompt.
 * @param systemPrompt Optional system prompt.
 * @param step Step configuration.
 * @returns Chat request DTO.
 */
function buildStepRequest(
    model: string,
    conversation: readonly IMessageDTO[],
    prompt: string,
    systemPrompt: string | undefined,
    step: IResolvedLlmChainStepDefinition,
): IChatRequestDTO {
    const messages: IMessageDTO[] = []

    if (systemPrompt !== undefined) {
        messages.push({
            role: MESSAGE_ROLE.SYSTEM,
            content: systemPrompt,
        })
    }

    messages.push(...conversation)
    messages.push({
        role: MESSAGE_ROLE.USER,
        content: prompt,
    })

    return {
        model,
        messages,
        temperature: step.temperature,
        maxTokens: step.maxTokens,
        tools: step.tools,
        responseFormat: step.responseFormat,
    }
}

/**
 * Converts internal chain definition into public DTO.
 *
 * @param definition Internal definition.
 * @returns Public definition.
 */
function toPublicChainDefinition(
    definition: IResolvedLlmChainDefinition,
): ILlmChainDefinition {
    return {
        name: definition.name,
        systemTemplateName: definition.systemTemplateName,
        steps: definition.steps.map((step): ILlmChainStepDefinition => {
            return {
                name: step.name,
                templateName: step.templateName,
                model: step.model,
                temperature: step.temperature,
                maxTokens: step.maxTokens,
                tools: step.tools,
                responseFormat: step.responseFormat,
                outputVariableName: step.outputVariableName,
                maxAttempts: step.maxAttempts,
                retryBackoffMs: step.retryBackoffMs,
            }
        }),
    }
}

/**
 * Resolves safe lower-level cause message from unknown error.
 *
 * @param error Unknown error payload.
 * @returns Cause message or undefined.
 */
function resolveCauseMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    return undefined
}

/**
 * Sleeps for provided milliseconds.
 *
 * @param delayMs Delay milliseconds.
 * @returns Promise resolved after delay.
 */
function sleepForMilliseconds(delayMs: number): Promise<void> {
    if (delayMs === 0) {
        return Promise.resolve()
    }
    return new Promise((resolve): void => {
        setTimeout(resolve, delayMs)
    })
}

/**
 * Serializes unknown value into deterministic string.
 *
 * @param value Unknown payload.
 * @returns Deterministic serialized value.
 */
function stableSerialize(value: unknown): string {
    if (value === null) {
        return "null"
    }

    if (Array.isArray(value)) {
        return serializeArrayValue(value)
    }

    if (isRecord(value)) {
        return serializeRecordValue(value)
    }

    return serializeScalarValue(value)
}

/**
 * Type guard for object records.
 *
 * @param value Unknown value.
 * @returns True when value is object record.
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null
}

/**
 * Serializes array into deterministic string.
 *
 * @param value Array value.
 * @returns Serialized array.
 */
function serializeArrayValue(value: readonly unknown[]): string {
    return `[${value.map((item): string => stableSerialize(item)).join(",")}]`
}

/**
 * Serializes object record into deterministic string.
 *
 * @param value Record value.
 * @returns Serialized record.
 */
function serializeRecordValue(value: Readonly<Record<string, unknown>>): string {
    const entries = Object.keys(value)
        .sort((left, right): number => left.localeCompare(right))
        .map((key): string => {
            return `${JSON.stringify(key)}:${stableSerialize(value[key])}`
        })

    return `{${entries.join(",")}}`
}

/**
 * Serializes scalar and special values.
 *
 * @param value Scalar-like value.
 * @returns Serialized scalar.
 */
function serializeScalarValue(value: unknown): string {
    switch (typeof value) {
        case "string":
            return JSON.stringify(value)
        case "number":
        case "boolean":
            return String(value)
        case "undefined":
            return "undefined"
        case "bigint":
            return `bigint:${value.toString()}`
        case "symbol":
            return `symbol:${value.description ?? ""}`
        case "function":
            return "function"
        default:
            return "unknown"
    }
}
