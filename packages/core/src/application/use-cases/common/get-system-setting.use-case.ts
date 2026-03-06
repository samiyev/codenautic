import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {ISystemSettingsRepository} from "../../ports/outbound/common/system-settings-repository.port"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import {Result} from "../../../shared/result"
import type {
    IGetSystemSettingOutput,
    ISystemSettingKeyInput,
} from "../../dto/common/system-setting.dto"
import {mapSystemSettingToDTO} from "../../dto/common/system-setting.dto"

/**
 * Dependencies for system setting lookup.
 */
export interface IGetSystemSettingUseCaseDependencies {
    /**
     * CRUD settings repository.
     */
    readonly systemSettingsRepository: ISystemSettingsRepository
}

/**
 * Returns one system setting by key.
 */
export class GetSystemSettingUseCase
    implements IUseCase<ISystemSettingKeyInput, IGetSystemSettingOutput, ValidationError>
{
    private readonly systemSettingsRepository: ISystemSettingsRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Dependency set.
     */
    public constructor(dependencies: IGetSystemSettingUseCaseDependencies) {
        this.systemSettingsRepository = dependencies.systemSettingsRepository
    }

    /**
     * Resolves system setting value by key.
     *
     * @param input Request payload.
     * @returns Setting value or validation error.
     */
    public async execute(
        input: ISystemSettingKeyInput,
    ): Promise<Result<IGetSystemSettingOutput, ValidationError>> {
        const validationError = this.validateKey(input.key)
        if (validationError !== undefined) {
            return Result.fail<IGetSystemSettingOutput, ValidationError>(
                new ValidationError("Get system setting validation failed", [validationError]),
            )
        }

        const setting = await this.systemSettingsRepository.findByKey(input.key.trim())
        if (setting === null) {
            return Result.fail<IGetSystemSettingOutput, ValidationError>(
                new ValidationError("Get system setting validation failed", [
                    {
                        field: "key",
                        message: "setting not found",
                    },
                ]),
            )
        }

        return Result.ok<IGetSystemSettingOutput, ValidationError>({
            setting: mapSystemSettingToDTO(setting),
        })
    }

    /**
     * Validates key value.
     *
     * @param key Raw key value.
     * @returns Validation field error when invalid.
     */
    private validateKey(key: unknown): IValidationErrorField | undefined {
        if (typeof key !== "string" || key.trim().length === 0) {
            return {
                field: "key",
                message: "must be a non-empty string",
            }
        }

        return undefined
    }
}
