import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IRuleRepository} from "../../ports/outbound/rule/rule-repository.port"
import {RULE_STATUS} from "../../../domain/aggregates/rule.aggregate"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import type {IGetEnabledRulesInput, IGetEnabledRulesOutput} from "../../dto/rules/get-enabled-rules.dto"
import type {ITeamRuleProvider} from "../../ports/outbound/rule/team-rule-provider.port"
import {Result} from "../../../shared/result"

interface INormalizedGetEnabledRulesInput {
    /**
     * Organization identifier.
     */
    readonly organizationId: string

    /**
     * Global rule ids configured in hierarchy.
     */
    readonly globalRuleIds: readonly string[]

    /**
     * Organization-level rule ids configured in hierarchy.
     */
    readonly organizationRuleIds: readonly string[]

    /**
     * Optional team context override.
     */
    readonly teamId?: string
}

/** Dependencies for enabled-rules resolution. */
export interface IGetEnabledRulesDependencies {
    /**
     * Rule persistence port.
     */
    readonly ruleRepository: IRuleRepository

    /**
     * Optional team rules override provider.
     */
    readonly teamRuleProvider?: ITeamRuleProvider
}

/**
 * Use-case for merging enabled rules through hierarchy:
 * global -> organization -> team.
 */
export class GetEnabledRulesUseCase
    implements IUseCase<IGetEnabledRulesInput, IGetEnabledRulesOutput, ValidationError>
{
    private readonly ruleRepository: IRuleRepository
    private readonly teamRuleProvider?: ITeamRuleProvider

    /**
     * Creates use case.
     *
     * @param dependencies Use-case dependencies.
     */
    public constructor(dependencies: IGetEnabledRulesDependencies) {
        this.ruleRepository = dependencies.ruleRepository
        this.teamRuleProvider = dependencies.teamRuleProvider
    }

    /**
     * Resolves enabled rule ids for hierarchy context.
     *
     * @param input Input payload.
     * @returns Ordered list of enabled rules.
     */
    public async execute(input: IGetEnabledRulesInput): Promise<
        Result<IGetEnabledRulesOutput, ValidationError>
    > {
        const normalized = this.validateAndNormalizeInput(input)
        if (normalized.isFail) {
            return Result.fail<IGetEnabledRulesOutput, ValidationError>(normalized.error)
        }

        const activeRuleIds = await this.getActiveRuleIds()
        const disabledRuleIds = new Set<string>()
        const resolvedRuleIds = new Set<string>()

        this.mergeRules(normalized.value.globalRuleIds, activeRuleIds, disabledRuleIds, resolvedRuleIds)
        this.mergeRules(
            normalized.value.organizationRuleIds,
            activeRuleIds,
            disabledRuleIds,
            resolvedRuleIds,
        )

        const teamId = normalized.value.teamId
        if (teamId !== undefined && this.teamRuleProvider !== undefined) {
            const configuration = await this.teamRuleProvider.getTeamRuleConfiguration(teamId)
            if (configuration !== null) {
                for (const disabledRuleId of configuration.disabledRuleUuids) {
                    disabledRuleIds.add(disabledRuleId)
                    resolvedRuleIds.delete(disabledRuleId)
                }
                this.mergeRules(
                    configuration.ruleIds,
                    activeRuleIds,
                    disabledRuleIds,
                    resolvedRuleIds,
                )
            }
        }

        return Result.ok<IGetEnabledRulesOutput, ValidationError>({
            ruleIds: Object.freeze([...resolvedRuleIds]),
        })
    }

    /**
     * Loads all active rule ids from repository.
     *
     * @returns Active ids.
     */
    private async getActiveRuleIds(): Promise<ReadonlySet<string>> {
        const rules = await this.ruleRepository.findByStatus(RULE_STATUS.ACTIVE)
        const activeRuleIds = new Set<string>()
        for (const rule of rules) {
            activeRuleIds.add(rule.id.value)
        }

        return activeRuleIds
    }

    /**
     * Merges layer ids with higher layer override semantics.
     *
     * @param layerRuleIds Rule ids from one layer.
     * @param activeRuleIds Active rule ids from repository.
     * @param disabledRuleIds Disabled rule ids.
     * @param resolvedRuleIds Accumulated resolved ids.
     */
    private mergeRules(
        layerRuleIds: readonly string[],
        activeRuleIds: ReadonlySet<string>,
        disabledRuleIds: ReadonlySet<string>,
        resolvedRuleIds: Set<string>,
    ): void {
        for (const ruleId of layerRuleIds) {
            if (disabledRuleIds.has(ruleId)) {
                resolvedRuleIds.delete(ruleId)
                continue
            }

            if (activeRuleIds.has(ruleId) === false) {
                continue
            }

            resolvedRuleIds.delete(ruleId)
            resolvedRuleIds.add(ruleId)
        }
    }

    /**
     * Validates and normalizes use-case input.
     *
     * @param input Raw input payload.
     * @returns Validation result and normalized input.
     */
    private validateAndNormalizeInput(
        input: unknown,
    ): Result<INormalizedGetEnabledRulesInput, ValidationError> {
        if (typeof input !== "object" || input === null || Array.isArray(input)) {
            return Result.fail<INormalizedGetEnabledRulesInput, ValidationError>(
                new ValidationError("Get enabled rules validation failed", [{
                    field: "input",
                    message: "must be a non-null object",
                }]),
            )
        }

        const payload = input as Record<string, unknown>
        const fields: IValidationErrorField[] = []
        const organizationId = this.normalizeOrganizationId(payload.organizationId)
        const globalRuleIdsValidation = this.validateRuleIdArray(
            payload.globalRuleIds,
            "globalRuleIds",
        )
        const organizationRuleIdsValidation = this.validateRuleIdArray(
            payload.organizationRuleIds,
            "organizationRuleIds",
        )
        const normalizedTeamId = this.normalizeTeamId(payload.teamId, fields)

        if (globalRuleIdsValidation.isFail) {
            fields.push(...globalRuleIdsValidation.error.fields)
        }
        if (organizationRuleIdsValidation.isFail) {
            fields.push(...organizationRuleIdsValidation.error.fields)
        }

        if (organizationId === undefined) {
            fields.push({
                field: "organizationId",
                message: "must be a non-empty string",
            })
            return Result.fail<INormalizedGetEnabledRulesInput, ValidationError>(
                new ValidationError("Get enabled rules validation failed", fields),
            )
        }

        if (fields.length > 0) {
            return Result.fail<INormalizedGetEnabledRulesInput, ValidationError>(
                new ValidationError("Get enabled rules validation failed", fields),
            )
        }

        return Result.ok<INormalizedGetEnabledRulesInput, ValidationError>({
            organizationId,
            globalRuleIds: globalRuleIdsValidation.value,
            organizationRuleIds: organizationRuleIdsValidation.value,
            teamId: normalizedTeamId,
        })
    }

    /**
     * Validates organizationId and returns normalized value.
     *
     * @param value Raw organizationId.
     * @returns Normalized value or undefined.
     */
    private normalizeOrganizationId(value: unknown): string | undefined {
        if (typeof value !== "string" || value.trim().length === 0) {
            return undefined
        }

        return value.trim()
    }

    /**
     * Normalizes teamId.
     *
     * @param teamId Raw team id.
     * @param fields Validation output collector.
     * @returns Normalized team id or undefined.
     */
    private normalizeTeamId(teamId: unknown, fields: IValidationErrorField[]): string | undefined {
        if (teamId === undefined) {
            return undefined
        }
        if (typeof teamId !== "string") {
            fields.push({
                field: "teamId",
                message: "must be a non-empty string when provided",
            })
            return undefined
        }

        const normalized = teamId.trim()
        if (normalized.length === 0) {
            fields.push({
                field: "teamId",
                message: "must be a non-empty string when provided",
            })
            return undefined
        }

        return normalized
    }

    /**
     * Validates and normalizes string identifiers.
     *
     * @param ruleIds Raw identifiers.
     * @param fieldName Field for validation diagnostics.
     * @param fields Validation output collector.
     * @returns Deduplicated normalized identifiers.
     */
    private validateRuleIdArray(
        ruleIds: unknown,
        fieldName: "globalRuleIds" | "organizationRuleIds",
    ): Result<readonly string[], ValidationError> {
        if (this.hasInvalidRuleIdCollection(ruleIds) === true) {
            return Result.fail<readonly string[], ValidationError>(
                new ValidationError("Get enabled rules validation failed", [{
                    field: fieldName,
                    message: "must be an array of non-empty strings",
                }]),
            )
        }

        if (ruleIds === undefined) {
            return Result.ok<readonly string[], ValidationError>([])
        }

        return this.normalizeRuleIds(
            ruleIds as readonly unknown[],
            fieldName,
        )
    }

    /**
     * Проверяет, что коллекция rule id корректного типа.
     *
     * @param ruleIds Raw array.
     * @returns True when collection is not suitable for processing.
     */
    private hasInvalidRuleIdCollection(ruleIds: unknown): boolean {
        if (ruleIds === undefined) {
            return false
        }

        return Array.isArray(ruleIds) === false
    }

    /**
     * Normalizes rule ids and removes duplicates.
     *
     * @param ruleIds Raw identifiers.
     * @param fieldName Field for validation diagnostics.
     * @returns Deduplicated normalized identifiers.
     */
    private normalizeRuleIds(
        ruleIds: readonly unknown[],
        fieldName: "globalRuleIds" | "organizationRuleIds",
    ): Result<readonly string[], ValidationError> {
        const normalized: string[] = []
        const seen = new Set<string>()

        for (const ruleId of ruleIds) {
            if (typeof ruleId !== "string") {
                return Result.fail<readonly string[], ValidationError>(
                    new ValidationError("Get enabled rules validation failed", [{
                        field: fieldName,
                        message: "must be an array of non-empty strings",
                    }]),
                )
            }

            const normalizedRuleId = ruleId.trim()
            if (normalizedRuleId.length === 0) {
                return Result.fail<readonly string[], ValidationError>(
                    new ValidationError("Get enabled rules validation failed", [{
                        field: fieldName,
                        message: "must be an array of non-empty strings",
                    }]),
                )
            }
            if (seen.has(normalizedRuleId) === false) {
                seen.add(normalizedRuleId)
                normalized.push(normalizedRuleId)
            }
        }

        return Result.ok<readonly string[], ValidationError>(normalized)
    }
}
