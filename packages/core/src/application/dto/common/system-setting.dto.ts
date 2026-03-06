/**
 * System setting DTO.
 */
export interface ISystemSettingDTO {
    readonly key: string
    readonly value: unknown
}

/**
 * Input payload for system setting upsert.
 */
export interface IUpsertSystemSettingInput {
    readonly key: string
    readonly value: unknown
}

/**
 * Output payload for system setting upsert.
 */
export interface IUpsertSystemSettingOutput {
    readonly setting: ISystemSettingDTO
}

/**
 * Input payload for system setting lookup/delete.
 */
export interface ISystemSettingKeyInput {
    readonly key: string
}

/**
 * Input payload for system setting lookup.
 */
export type IGetSystemSettingInput = ISystemSettingKeyInput

/**
 * Output payload for system setting lookup.
 */
export interface IGetSystemSettingOutput {
    readonly setting: ISystemSettingDTO
}

/**
 * Input payload for listing settings.
 */
export interface IListSystemSettingsInput {
}

/**
 * Output payload for listing settings.
 */
export interface IListSystemSettingsOutput {
    readonly settings: readonly ISystemSettingDTO[]
    readonly total: number
}

/**
 * Output payload for system setting deletion.
 */
export interface IDeleteSystemSettingOutput {
    readonly key: string
}

/**
 * Maps raw system setting record to DTO.
 *
 * @param record Setting record.
 * @returns DTO payload.
 */
export function mapSystemSettingToDTO(record: {readonly key: string; readonly value: unknown}): ISystemSettingDTO {
    return {
        key: record.key,
        value: record.value,
    }
}
