import {
    FilePath,
    type IAstCallDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type SupportedLanguage,
} from "@codenautic/core"

import {
    AST_FUNCTION_SIMILARITY_ERROR_CODE,
    AstFunctionSimilarityError,
} from "./ast-function-similarity.error"

const DEFAULT_MINIMUM_SIMILARITY = 0.5

/**
 * Function snapshot used for one similarity comparison side.
 */
export interface IAstFunctionSimilarityTarget {
    /**
     * Repository-relative file path that owns function declaration.
     */
    readonly filePath: string

    /**
     * Parsed language for source file.
     */
    readonly language: SupportedLanguage

    /**
     * Function metadata extracted by parser.
     */
    readonly function: IAstFunctionDTO

    /**
     * Optional imports from source file.
     */
    readonly imports?: readonly IAstImportDTO[]

    /**
     * Optional call expressions from source file.
     */
    readonly calls?: readonly IAstCallDTO[]
}

/**
 * Runtime input for one function similarity comparison.
 */
export interface IAstFunctionSimilarityInput {
    /**
     * First function snapshot.
     */
    readonly left: IAstFunctionSimilarityTarget

    /**
     * Second function snapshot.
     */
    readonly right: IAstFunctionSimilarityTarget

    /**
     * Optional Jaccard threshold in range `[0, 1]`.
     */
    readonly minimumSimilarity?: number
}

/**
 * LLM validation payload used after structural threshold pass.
 */
export interface IAstFunctionSimilarityLlmValidationInput {
    /**
     * First compared function snapshot.
     */
    readonly left: IAstFunctionSimilarityTarget

    /**
     * Second compared function snapshot.
     */
    readonly right: IAstFunctionSimilarityTarget

    /**
     * Structural Jaccard similarity in range `[0, 1]`.
     */
    readonly similarity: number

    /**
     * Shared feature tokens.
     */
    readonly sharedFeatures: readonly string[]
}

/**
 * LLM validation result payload.
 */
export interface IAstFunctionSimilarityLlmValidationResult {
    /**
     * Final semantic similarity decision.
     */
    readonly isSimilar: boolean

    /**
     * Human-readable rationale for semantic decision.
     */
    readonly explanation: string
}

/**
 * Optional LLM validator callback used for semantic confirmation.
 */
export type AstFunctionSimilarityLlmValidator = (
    input: IAstFunctionSimilarityLlmValidationInput,
) => Promise<IAstFunctionSimilarityLlmValidationResult>

/**
 * Output payload for one function similarity comparison.
 */
export interface IAstFunctionSimilarityResult {
    /**
     * Final similarity decision.
     */
    readonly isSimilar: boolean

    /**
     * Structural Jaccard similarity in range `[0, 1]`.
     */
    readonly similarity: number

    /**
     * Applied minimum similarity threshold.
     */
    readonly threshold: number

    /**
     * Shared feature tokens sorted deterministically.
     */
    readonly sharedFeatures: readonly string[]

    /**
     * Feature count for first function.
     */
    readonly leftFeatureCount: number

    /**
     * Feature count for second function.
     */
    readonly rightFeatureCount: number

    /**
     * Whether optional LLM validator participated in final decision.
     */
    readonly usedLlmValidation: boolean

    /**
     * Human-readable decision rationale.
     */
    readonly explanation: string
}

/**
 * Construction options for function similarity service.
 */
export interface IAstFunctionSimilarityServiceOptions {
    /**
     * Optional default minimum similarity threshold in range `[0, 1]`.
     */
    readonly defaultMinimumSimilarity?: number

    /**
     * Optional semantic validator callback.
     */
    readonly llmValidator?: AstFunctionSimilarityLlmValidator
}

/**
 * Function similarity service contract.
 */
export interface IAstFunctionSimilarityService {
    /**
     * Compares two function snapshots by structural and optional semantic signals.
     *
     * @param input Similarity input payload.
     * @returns Similarity result payload.
     */
    areFunctionsSimilar(input: IAstFunctionSimilarityInput): Promise<IAstFunctionSimilarityResult>
}

interface IPreparedFunctionSimilarityTarget {
    readonly filePath: string
    readonly language: SupportedLanguage
    readonly functionName: string
    readonly function: IAstFunctionDTO
    readonly imports: readonly IAstImportDTO[]
    readonly calls: readonly IAstCallDTO[]
}

interface IResolvedFunctionSimilarityInput {
    readonly left: IPreparedFunctionSimilarityTarget
    readonly right: IPreparedFunctionSimilarityTarget
    readonly minimumSimilarity: number
}

interface IFunctionFeatureComparison {
    readonly similarity: number
    readonly sharedFeatures: readonly string[]
    readonly leftFeatureCount: number
    readonly rightFeatureCount: number
}

/**
 * AST function similarity service with optional LLM semantic validation.
 */
export class AstFunctionSimilarityService implements IAstFunctionSimilarityService {
    private readonly defaultMinimumSimilarity: number
    private readonly llmValidator?: AstFunctionSimilarityLlmValidator

    /**
     * Creates function similarity service.
     *
     * @param options Optional service defaults.
     */
    public constructor(options: IAstFunctionSimilarityServiceOptions = {}) {
        this.defaultMinimumSimilarity = validateMinimumSimilarity(
            options.defaultMinimumSimilarity ?? DEFAULT_MINIMUM_SIMILARITY,
        )
        this.llmValidator = options.llmValidator
    }

    /**
     * Compares two functions by Jaccard similarity and optional LLM validation.
     *
     * @param input Similarity input payload.
     * @returns Similarity result payload.
     */
    public async areFunctionsSimilar(
        input: IAstFunctionSimilarityInput,
    ): Promise<IAstFunctionSimilarityResult> {
        const resolvedInput = resolveInput(input, this.defaultMinimumSimilarity)
        const comparison = compareFunctionFeatures(resolvedInput.left, resolvedInput.right)
        const passedStructuralThreshold = comparison.similarity >= resolvedInput.minimumSimilarity

        if (passedStructuralThreshold === false) {
            return {
                isSimilar: false,
                similarity: comparison.similarity,
                threshold: resolvedInput.minimumSimilarity,
                sharedFeatures: comparison.sharedFeatures,
                leftFeatureCount: comparison.leftFeatureCount,
                rightFeatureCount: comparison.rightFeatureCount,
                usedLlmValidation: false,
                explanation: createStructuralExplanation(
                    comparison.similarity,
                    resolvedInput.minimumSimilarity,
                    comparison.sharedFeatures.length,
                    false,
                ),
            }
        }

        if (this.llmValidator === undefined) {
            return {
                isSimilar: true,
                similarity: comparison.similarity,
                threshold: resolvedInput.minimumSimilarity,
                sharedFeatures: comparison.sharedFeatures,
                leftFeatureCount: comparison.leftFeatureCount,
                rightFeatureCount: comparison.rightFeatureCount,
                usedLlmValidation: false,
                explanation: createStructuralExplanation(
                    comparison.similarity,
                    resolvedInput.minimumSimilarity,
                    comparison.sharedFeatures.length,
                    true,
                ),
            }
        }

        const llmValidation = await this.validateWithLlm(resolvedInput, comparison)
        const structuralExplanation = createStructuralExplanation(
            comparison.similarity,
            resolvedInput.minimumSimilarity,
            comparison.sharedFeatures.length,
            true,
        )

        return {
            isSimilar: llmValidation.isSimilar,
            similarity: comparison.similarity,
            threshold: resolvedInput.minimumSimilarity,
            sharedFeatures: comparison.sharedFeatures,
            leftFeatureCount: comparison.leftFeatureCount,
            rightFeatureCount: comparison.rightFeatureCount,
            usedLlmValidation: true,
            explanation: `${structuralExplanation} LLM validation: ${llmValidation.explanation}`,
        }
    }

    /**
     * Runs optional LLM validator and validates returned payload shape.
     *
     * @param input Resolved similarity input.
     * @param comparison Structural similarity comparison output.
     * @returns Validated LLM decision.
     */
    private async validateWithLlm(
        input: IResolvedFunctionSimilarityInput,
        comparison: IFunctionFeatureComparison,
    ): Promise<IAstFunctionSimilarityLlmValidationResult> {
        if (this.llmValidator === undefined) {
            throw new AstFunctionSimilarityError(
                AST_FUNCTION_SIMILARITY_ERROR_CODE.LLM_VALIDATION_FAILED,
                {reason: "LLM validator is not configured"},
            )
        }

        try {
            const rawResult = await this.llmValidator({
                left: restoreTarget(input.left),
                right: restoreTarget(input.right),
                similarity: comparison.similarity,
                sharedFeatures: comparison.sharedFeatures,
            })

            return normalizeLlmValidationResult(rawResult)
        } catch (error: unknown) {
            if (error instanceof AstFunctionSimilarityError) {
                throw error
            }

            throw new AstFunctionSimilarityError(
                AST_FUNCTION_SIMILARITY_ERROR_CODE.LLM_VALIDATION_FAILED,
                {reason: normalizeErrorReason(error)},
            )
        }
    }
}

/**
 * Restores public target payload from prepared target.
 *
 * @param target Prepared target.
 * @returns Public target payload.
 */
function restoreTarget(target: IPreparedFunctionSimilarityTarget): IAstFunctionSimilarityTarget {
    return {
        filePath: target.filePath,
        language: target.language,
        function: target.function,
        imports: target.imports,
        calls: target.calls,
    }
}

/**
 * Resolves runtime input with normalized targets and threshold.
 *
 * @param input Raw similarity input payload.
 * @param defaultMinimumSimilarity Service default threshold.
 * @returns Resolved and validated input.
 */
function resolveInput(
    input: IAstFunctionSimilarityInput,
    defaultMinimumSimilarity: number,
): IResolvedFunctionSimilarityInput {
    return {
        left: prepareTarget(input.left),
        right: prepareTarget(input.right),
        minimumSimilarity: validateMinimumSimilarity(
            input.minimumSimilarity ?? defaultMinimumSimilarity,
        ),
    }
}

/**
 * Prepares one target for deterministic feature extraction.
 *
 * @param target Raw target payload.
 * @returns Prepared target.
 */
function prepareTarget(target: IAstFunctionSimilarityTarget): IPreparedFunctionSimilarityTarget {
    return {
        filePath: normalizeFilePath(target.filePath),
        language: target.language,
        functionName: normalizeFunctionName(target.function.name),
        function: target.function,
        imports: target.imports ?? [],
        calls: target.calls ?? [],
    }
}

/**
 * Compares two prepared targets by Jaccard similarity.
 *
 * @param left Left prepared target.
 * @param right Right prepared target.
 * @returns Feature comparison output.
 */
function compareFunctionFeatures(
    left: IPreparedFunctionSimilarityTarget,
    right: IPreparedFunctionSimilarityTarget,
): IFunctionFeatureComparison {
    const leftFeatures = extractFunctionFeatures(left)
    const rightFeatures = extractFunctionFeatures(right)
    const sharedFeatures = [...leftFeatures].filter((feature) => rightFeatures.has(feature))
    sharedFeatures.sort()

    const unionSize = new Set([
        ...leftFeatures,
        ...rightFeatures,
    ]).size
    const similarity = unionSize === 0 ? 0 : roundSimilarity(sharedFeatures.length / unionSize)

    return {
        similarity,
        sharedFeatures,
        leftFeatureCount: leftFeatures.size,
        rightFeatureCount: rightFeatures.size,
    }
}

/**
 * Extracts deterministic feature set from one function target.
 *
 * @param target Prepared function target.
 * @returns Feature set.
 */
function extractFunctionFeatures(target: IPreparedFunctionSimilarityTarget): ReadonlySet<string> {
    const features = new Set<string>()
    features.add(`language:${normalizeToken(target.language)}`)
    features.add(`kind:${normalizeToken(target.function.kind)}`)
    features.add(`async:${target.function.async ? "1" : "0"}`)
    features.add(`exported:${target.function.exported ? "1" : "0"}`)
    features.add(`span:${resolveSpanBucket(target.function.location.lineStart, target.function.location.lineEnd)}`)

    const parentClassName = normalizeOptionalToken(target.function.parentClassName)
    if (parentClassName !== undefined) {
        features.add(`parent:${parentClassName}`)
    }

    for (const fileImport of target.imports) {
        const source = normalizeOptionalToken(fileImport.source)
        if (source !== undefined) {
            features.add(`import:${source}`)
        }
    }

    for (const call of target.calls) {
        if (belongsToFunctionCall(call, target.functionName) === false) {
            continue
        }

        const callee = normalizeOptionalToken(call.callee)
        if (callee !== undefined) {
            features.add(`call:${callee}`)
        }
    }

    return features
}

/**
 * Resolves coarse function span bucket by line count.
 *
 * @param lineStart Function start line.
 * @param lineEnd Function end line.
 * @returns Span bucket token.
 */
function resolveSpanBucket(lineStart: number, lineEnd: number): string {
    const lineCount = Math.max(1, lineEnd - lineStart + 1)

    if (lineCount <= 5) {
        return "short"
    }

    if (lineCount <= 20) {
        return "medium"
    }

    return "long"
}

/**
 * Checks whether call belongs to target function context.
 *
 * @param call Call DTO.
 * @param functionName Target function name.
 * @returns True when call belongs to function context.
 */
function belongsToFunctionCall(call: IAstCallDTO, functionName: string): boolean {
    const caller = normalizeOptionalToken(call.caller)
    if (caller === undefined) {
        return true
    }

    return caller === normalizeToken(functionName)
}

/**
 * Validates and normalizes file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized repository-relative file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstFunctionSimilarityError(AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_FILE_PATH, {
            filePath,
        })
    }
}

/**
 * Validates and normalizes function name.
 *
 * @param functionName Raw function name.
 * @returns Normalized function name.
 */
function normalizeFunctionName(functionName: string): string {
    const normalizedFunctionName = functionName.trim()
    if (normalizedFunctionName.length === 0) {
        throw new AstFunctionSimilarityError(
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_FUNCTION_NAME,
            {functionName},
        )
    }

    return normalizedFunctionName
}

/**
 * Validates minimum similarity threshold.
 *
 * @param minimumSimilarity Raw threshold.
 * @returns Validated threshold.
 */
function validateMinimumSimilarity(minimumSimilarity: number): number {
    if (Number.isFinite(minimumSimilarity) === false) {
        throw new AstFunctionSimilarityError(
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
            {minimumSimilarity},
        )
    }

    if (minimumSimilarity < 0 || minimumSimilarity > 1) {
        throw new AstFunctionSimilarityError(
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
            {minimumSimilarity},
        )
    }

    return minimumSimilarity
}

/**
 * Normalizes one required token to deterministic lower-case feature value.
 *
 * @param value Raw token.
 * @returns Normalized token.
 */
function normalizeToken(value: string): string {
    return value.trim().toLowerCase()
}

/**
 * Normalizes optional token and filters blank values.
 *
 * @param value Optional raw token.
 * @returns Normalized token or undefined.
 */
function normalizeOptionalToken(value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined
    }

    const normalizedValue = normalizeToken(value)
    return normalizedValue.length > 0 ? normalizedValue : undefined
}

/**
 * Rounds similarity for deterministic output stability.
 *
 * @param similarity Raw similarity score.
 * @returns Rounded similarity score.
 */
function roundSimilarity(similarity: number): number {
    return Math.round(similarity * 10000) / 10000
}

/**
 * Builds structural explanation for similarity decision.
 *
 * @param similarity Rounded similarity score.
 * @param threshold Applied threshold.
 * @param sharedFeatureCount Number of shared features.
 * @param passedThreshold Whether structural threshold passed.
 * @returns Human-readable explanation.
 */
function createStructuralExplanation(
    similarity: number,
    threshold: number,
    sharedFeatureCount: number,
    passedThreshold: boolean,
): string {
    const comparison = passedThreshold ? "meets" : "is below"
    return `Jaccard similarity ${similarity} ${comparison} threshold ${threshold} with ${sharedFeatureCount} shared features.`
}

/**
 * Normalizes unknown failure to stable reason text.
 *
 * @param error Unknown failure.
 * @returns Stable failure reason.
 */
function normalizeErrorReason(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    if (typeof error === "string") {
        return error
    }

    return "Unknown failure"
}

/**
 * Validates LLM validation payload shape.
 *
 * @param result Unknown LLM payload.
 * @returns Validated LLM validation result.
 */
function normalizeLlmValidationResult(
    result: unknown,
): IAstFunctionSimilarityLlmValidationResult {
    if (isPlainObject(result) === false) {
        throw new AstFunctionSimilarityError(
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_LLM_VALIDATION_RESULT,
            {reason: "LLM validation payload must be an object"},
        )
    }

    const isSimilar = result["isSimilar"]
    if (typeof isSimilar !== "boolean") {
        throw new AstFunctionSimilarityError(
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_LLM_VALIDATION_RESULT,
            {reason: "LLM validation payload must include boolean isSimilar"},
        )
    }

    const explanation = result["explanation"]
    if (typeof explanation !== "string" || explanation.trim().length === 0) {
        throw new AstFunctionSimilarityError(
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_LLM_VALIDATION_RESULT,
            {reason: "LLM validation payload must include non-empty explanation"},
        )
    }

    return {
        isSimilar,
        explanation: explanation.trim(),
    }
}

/**
 * Checks whether unknown value is plain object.
 *
 * @param value Unknown value.
 * @returns True when value is plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}
