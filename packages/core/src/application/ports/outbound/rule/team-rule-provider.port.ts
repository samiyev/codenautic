/**
 * Поставщик командной конфигурации правил.
 */
export interface ITeamRuleConfiguration {
    /**
     * Идентификаторы правил, включённых для команды.
     */
    readonly ruleIds: readonly string[]

    /**
     * Идентификаторы правил, отключённых для команды.
     */
    readonly disabledRuleUuids: readonly string[]
}

/**
 * Port для загрузки конфигурации правил команды.
 */
export interface ITeamRuleProvider {
    /**
     * Возвращает конфигурацию правил для конкретной команды.
     *
     * @param teamId Team identifier.
     * @returns Rule configuration when team exists, otherwise null.
     */
    getTeamRuleConfiguration(teamId: string): Promise<ITeamRuleConfiguration | null>
}
