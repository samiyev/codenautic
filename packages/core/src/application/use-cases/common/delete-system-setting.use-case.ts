import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {ISystemSettingsRepository} from "../../ports/outbound/common/system-settings-repository.port"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import type {
    IDeleteSystemSettingOutput,
    ISystemSettingKeyInput,
} from "../../dto/common/system-setting.dto"
import {Result} from "../../../shared/result"

/**
 * Dependencies for system setting deletion.
 */
export interface IDeleteSystemSettingUseCaseDependencies {
    readonly systemSettingsRepository: ISystemSettingsRepository
}

/**
 * Deletes system setting by key.
 */
export class DeleteSystemSettingUseCase
    implements IUseCase<ISystemSettingKeyInput, IDeleteSystemSettingOutput, ValidationError>
{
    private readonly systemSettingsRepository: ISystemSettingsRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IDeleteSystemSettingUseCaseDependencies) {
        this.systemSettingsRepository = dependencies.systemSettingsRepository
    }

    /**
     * Deletes system setting by key.
     *
     * @param input Request payload.
     * @returns Deleted key.
     */
    public async execute(
        input: ISystemSettingKeyInput,
    ): Promise<Result<IDeleteSystemSettingOutput, ValidationError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IDeleteSystemSettingOutput, ValidationError>(
                new ValidationError("System setting delete validation failed", fields),
            )
        }

        const normalizedKey = input.key.trim()
        const existing = await this.systemSettingsRepository.findByKey(normalizedKey)
        if (existing === null) {
            return Result.fail<IDeleteSystemSettingOutput, ValidationError>(
                new ValidationError("System setting delete validation failed", [
                    {
                        field: "key",
                        message: "setting not found",
                    },
                ]),
            )
        }

        await this.systemSettingsRepository.deleteByKey(normalizedKey)

        return Result.ok<IDeleteSystemSettingOutput, ValidationError>({
            key: normalizedKey,
        })
    }

    private validateInput(input: ISystemSettingKeyInput): IValidationErrorField[] {
        if (typeof input.key !== "string" || input.key.trim().length === 0) {
            return [
                {
                    field: "key",
                    message: "must be a non-empty string",
                },
            ]
        }

        return []
    }
}
