/**
 * Входной DTO для расчёта активных правил ревью.
 */
export interface IGetEnabledRulesInput {
    /**
     * Организация, для которой выбираются правила.
     */
    readonly organizationId: string

    /**
     * Базовые (глобальные) правила по умолчанию.
     */
    readonly globalRuleIds?: readonly string[]

    /**
     * Правила, заданные на уровне организации.
     */
    readonly organizationRuleIds?: readonly string[]

    /**
     * Опциональный идентификатор команды.
     */
    readonly teamId?: string
}

/**
 * Результат для расчёта активных правил ревью.
 */
export interface IGetEnabledRulesOutput {
    /**
     * Идентификаторы включённых правил после слияния слоёв.
     */
    readonly ruleIds: readonly string[]
}
