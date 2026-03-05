import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {ISystemSettingsProvider} from "../../ports/outbound/common/system-settings-provider.port"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import {Result} from "../../../shared/result"

/**
 * Input payload for system setting lookup.
 */
export interface IGetSystemSettingInput {
    /**
     * Setting key.
     */
    readonly key: string
}

/**
 * Output payload for system setting lookup.
 */
export interface IGetSystemSettingOutput {
    /**
     * Requested key.
     */
    readonly key: string

    /**
     * Resolved setting value.
     */
    readonly value: unknown
}

/**
 * Dependencies for system setting lookup.
 */
export interface IGetSystemSettingUseCaseDependencies {
    /**
     * Read-only settings provider.
     */
    readonly systemSettingsProvider: ISystemSettingsProvider
}

/**
 * Returns one system setting by key.
 */
export class GetSystemSettingUseCase
    implements IUseCase<IGetSystemSettingInput, IGetSystemSettingOutput, ValidationError>
{
    private readonly systemSettingsProvider: ISystemSettingsProvider

    /**
     * Creates use case instance.
     *
     * @param dependencies Dependency set.
     */
    public constructor(dependencies: IGetSystemSettingUseCaseDependencies) {
        this.systemSettingsProvider = dependencies.systemSettingsProvider
    }

    /**
     * Resolves system setting value by key.
     *
     * @param input Request payload.
     * @returns Setting value or validation error.
     */
    public async execute(
        input: IGetSystemSettingInput,
    ): Promise<Result<IGetSystemSettingOutput, ValidationError>> {
        const validationError = this.validateKey(input.key)
        if (validationError !== undefined) {
            return Result.fail<IGetSystemSettingOutput, ValidationError>(
                new ValidationError("Get system setting validation failed", [validationError]),
            )
        }

        try {
            const value = await this.systemSettingsProvider.get<unknown>(input.key)
            return Result.ok<IGetSystemSettingOutput, ValidationError>({
                key: input.key,
                value,
            })
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "system setting lookup failed"
            return Result.fail<IGetSystemSettingOutput, ValidationError>(
                new ValidationError("Get system setting failed", [{
                    field: "key",
                    message,
                }]),
            )
        }
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
