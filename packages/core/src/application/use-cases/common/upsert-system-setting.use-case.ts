import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {ISystemSettingsRepository} from "../../ports/outbound/common/system-settings-repository.port"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import type {
    IUpsertSystemSettingInput,
    IUpsertSystemSettingOutput,
} from "../../dto/common/system-setting.dto"
import {mapSystemSettingToDTO} from "../../dto/common/system-setting.dto"
import {Result} from "../../../shared/result"

/**
 * Dependencies for system setting upsert.
 */
export interface IUpsertSystemSettingUseCaseDependencies {
    readonly systemSettingsRepository: ISystemSettingsRepository
}

/**
 * Creates or updates system setting values.
 */
export class UpsertSystemSettingUseCase
    implements IUseCase<IUpsertSystemSettingInput, IUpsertSystemSettingOutput, ValidationError>
{
    private readonly systemSettingsRepository: ISystemSettingsRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IUpsertSystemSettingUseCaseDependencies) {
        this.systemSettingsRepository = dependencies.systemSettingsRepository
    }

    /**
     * Upserts system setting.
     *
     * @param input Request payload.
     * @returns Upserted setting DTO.
     */
    public async execute(
        input: IUpsertSystemSettingInput,
    ): Promise<Result<IUpsertSystemSettingOutput, ValidationError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IUpsertSystemSettingOutput, ValidationError>(
                new ValidationError("System setting upsert validation failed", fields),
            )
        }

        const normalizedKey = input.key.trim()
        await this.systemSettingsRepository.upsert({
            key: normalizedKey,
            value: input.value,
        })

        return Result.ok<IUpsertSystemSettingOutput, ValidationError>({
            setting: mapSystemSettingToDTO({
                key: normalizedKey,
                value: input.value,
            }),
        })
    }

    private validateInput(input: IUpsertSystemSettingInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []
        if (typeof input.key !== "string" || input.key.trim().length === 0) {
            fields.push({
                field: "key",
                message: "must be a non-empty string",
            })
        }

        if (input.value === undefined) {
            fields.push({
                field: "value",
                message: "must be provided",
            })
        }

        return fields
    }
}
