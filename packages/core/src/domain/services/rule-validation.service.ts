import {ValidationError} from "../errors/validation.error"
import {CUSTOM_RULE_TYPE, type CustomRuleType} from "../entities/custom-rule.entity"
import {Result} from "../../shared/result"

/**
 * Service responsible for custom-rule syntax validation.
 */
export interface IRuleValidationConfig {
    /**
     * Maximum prompt body length.
     */
    readonly maxPromptLength?: number

    /**
     * Maximum regex text length.
     */
    readonly maxRegexLength?: number

    /**
     * Maximum AST query length.
     */
    readonly maxAstLength?: number
}

/**
 * Validation service for different custom rule types.
 */
export class RuleValidationService {
    private static readonly DEFAULT_MAX_PROMPT_LENGTH = 5000
    private static readonly DEFAULT_MAX_REGEX_LENGTH = 2000
    private static readonly DEFAULT_MAX_AST_LENGTH = 8000

    private readonly maxPromptLength: number
    private readonly maxRegexLength: number
    private readonly maxAstLength: number

    /**
     * Creates service with optional validation limits.
     *
     * @param config Optional limits.
     */
    public constructor(config?: IRuleValidationConfig) {
        this.maxPromptLength = Math.max(
            1,
            config?.maxPromptLength ?? RuleValidationService.DEFAULT_MAX_PROMPT_LENGTH,
        )
        this.maxRegexLength = Math.max(
            1,
            config?.maxRegexLength ?? RuleValidationService.DEFAULT_MAX_REGEX_LENGTH,
        )
        this.maxAstLength = Math.max(
            1,
            config?.maxAstLength ?? RuleValidationService.DEFAULT_MAX_AST_LENGTH,
        )
    }

    /**
     * Validates rule text by rule kind.
     *
     * @param ruleType Custom rule type.
     * @param ruleText Raw rule text.
     * @returns Validation result.
     */
    public validate(ruleType: CustomRuleType, ruleText: string): Result<void, ValidationError> {
        if (ruleType === CUSTOM_RULE_TYPE.REGEX) {
            return this.validateRegex(ruleText)
        }

        if (ruleType === CUSTOM_RULE_TYPE.PROMPT) {
            return this.validatePrompt(ruleText)
        }

        return this.validateAstQuery(ruleText)
    }

    /**
     * Validates regex payload.
     *
     * @param ruleText Rule payload.
     * @returns Validation result.
     */
    private validateRegex(ruleText: string): Result<void, ValidationError> {
        const normalizedText = ruleText.trim()
        if (normalizedText.length === 0) {
            return Result.fail(
                new ValidationError("Regex rule validation failed", [{
                    field: "rule",
                    message: "Regex rule must be a non-empty string",
                }]),
            )
        }

        if (normalizedText.length > this.maxRegexLength) {
            return Result.fail(
                new ValidationError("Regex rule validation failed", [{
                    field: "rule",
                    message: `Regex rule must be at most ${this.maxRegexLength} characters`,
                }]),
            )
        }

        try {
            new RegExp(normalizedText)
        } catch (error) {
            return Result.fail(
                new ValidationError("Regex rule validation failed", [{
                    field: "rule",
                    message: error instanceof Error ? error.message : "Invalid regex syntax",
                }]),
            )
        }

        return Result.ok<void, ValidationError>(void 0)
    }

    /**
     * Validates PROMPT payload.
     *
     * @param ruleText Prompt instruction.
     * @returns Validation result.
     */
    private validatePrompt(ruleText: string): Result<void, ValidationError> {
        const normalizedText = ruleText.trim()
        if (normalizedText.length === 0) {
            return Result.fail(
                new ValidationError("Prompt rule validation failed", [{
                    field: "rule",
                    message: "Prompt rule must be a non-empty string",
                }]),
            )
        }

        if (normalizedText.length > this.maxPromptLength) {
            return Result.fail(
                new ValidationError("Prompt rule validation failed", [{
                    field: "rule",
                    message: `Prompt rule must be at most ${this.maxPromptLength} characters`,
                }]),
            )
        }

        return Result.ok<void, ValidationError>(void 0)
    }

    /**
     * Validates AST query payload.
     *
     * @param ruleText AST query.
     * @returns Validation result.
     */
    private validateAstQuery(ruleText: string): Result<void, ValidationError> {
        const normalizedText = ruleText.trim()
        if (normalizedText.length === 0) {
            return Result.fail(
                new ValidationError("AST rule validation failed", [{
                    field: "rule",
                    message: "AST rule must be a non-empty string",
                }]),
            )
        }

        if (normalizedText.length > this.maxAstLength) {
            return Result.fail(
                new ValidationError("AST rule validation failed", [{
                    field: "rule",
                    message: `AST rule must be at most ${this.maxAstLength} characters`,
                }]),
            )
        }

        try {
            const parsed: unknown = JSON.parse(normalizedText)
            if (typeof parsed !== "object" || parsed === null) {
                return Result.fail(
                    new ValidationError("AST rule validation failed", [{
                        field: "rule",
                        message: "AST rule must be JSON object or array",
                    }]),
                )
            }
        } catch (error) {
            return Result.fail(
                new ValidationError("AST rule validation failed", [{
                    field: "rule",
                    message: error instanceof Error ? error.message : "AST query must be valid JSON",
                }]),
            )
        }

        return Result.ok<void, ValidationError>(void 0)
    }
}
