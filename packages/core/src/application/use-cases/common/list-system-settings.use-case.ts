import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {ISystemSettingsRepository} from "../../ports/outbound/common/system-settings-repository.port"
import type {
    IListSystemSettingsInput,
    IListSystemSettingsOutput,
} from "../../dto/common/system-setting.dto"
import {mapSystemSettingToDTO} from "../../dto/common/system-setting.dto"
import {Result} from "../../../shared/result"
import {ValidationError} from "../../../domain/errors/validation.error"

/**
 * Dependencies for system settings listing.
 */
export interface IListSystemSettingsUseCaseDependencies {
    readonly systemSettingsRepository: ISystemSettingsRepository
}

/**
 * Lists system settings for admin API.
 */
export class ListSystemSettingsUseCase
    implements IUseCase<IListSystemSettingsInput, IListSystemSettingsOutput, ValidationError>
{
    private readonly systemSettingsRepository: ISystemSettingsRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IListSystemSettingsUseCaseDependencies) {
        this.systemSettingsRepository = dependencies.systemSettingsRepository
    }

    /**
     * Lists all system settings.
     *
     * @param _input Request payload.
     * @returns List result.
     */
    public async execute(
        _input: IListSystemSettingsInput,
    ): Promise<Result<IListSystemSettingsOutput, ValidationError>> {
        const settings = await this.systemSettingsRepository.findAll()
        const mapped = settings.map((setting) => mapSystemSettingToDTO(setting))

        return Result.ok<IListSystemSettingsOutput, ValidationError>({
            settings: mapped,
            total: mapped.length,
        })
    }
}
