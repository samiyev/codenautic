import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IRepositoryIndexRepository} from "../../ports/outbound/scanning/repository-index-repository"
import {REPOSITORY_INDEX_STATUS, type IRepositoryIndex} from "../../dto/scanning"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import {RepositoryId} from "../../../domain/value-objects/repository-id.value-object"
import type {DomainError} from "../../../domain/errors/domain.error"
import {Result} from "../../../shared/result"

interface INormalizedGetRepositoryIndexInput {
    /**
     * Normalized repository identifier.
     */
    readonly repoId: string
}

/**
 * Input for repository index lookup.
 */
export interface IGetRepositoryIndexInput {
    /**
     * Repository identifier in `<platform>:<id>` format.
     */
    readonly repoId: string
}

/**
 * Dependencies for repository index query.
 */
export interface IGetRepositoryIndexUseCaseDependencies {
    /**
     * Repository index persistence port.
     */
    readonly repositoryIndexRepository: IRepositoryIndexRepository
}

/**
 * Loads repository index snapshot for known repositories.
 */
export class GetRepositoryIndexUseCase
    implements IUseCase<IGetRepositoryIndexInput, IRepositoryIndex, DomainError>
{
    private readonly repositoryIndexRepository: IRepositoryIndexRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Dependency set.
     */
    public constructor(dependencies: IGetRepositoryIndexUseCaseDependencies) {
        this.repositoryIndexRepository = dependencies.repositoryIndexRepository
    }

    /**
     * Loads repository index by repository id.
     *
     * @param input Request payload.
     * @returns Repository index or domain error.
     */
    public async execute(
        input: IGetRepositoryIndexInput,
    ): Promise<Result<IRepositoryIndex, DomainError>> {
        const normalizedInputResult = this.validateAndNormalizeInput(input)
        if (normalizedInputResult.isFail) {
            return Result.fail<IRepositoryIndex, DomainError>(
                normalizedInputResult.error,
            )
        }

        const repositoryIndex =
            await this.repositoryIndexRepository.getByRepositoryId(
                normalizedInputResult.value.repoId,
            )

        if (repositoryIndex === null) {
            return Result.fail<IRepositoryIndex, DomainError>(
                new NotFoundError(
                    "RepositoryIndex",
                    normalizedInputResult.value.repoId,
                ),
            )
        }

        if (repositoryIndex.status === REPOSITORY_INDEX_STATUS.NOT_INDEXED) {
            return Result.fail<IRepositoryIndex, DomainError>(
                new NotFoundError(
                    "RepositoryIndex",
                    normalizedInputResult.value.repoId,
                ),
            )
        }

        return Result.ok<IRepositoryIndex, DomainError>(repositoryIndex)
    }

    /**
     * Validates and normalizes input payload.
     *
     * @param input Raw input.
     * @returns Normalized payload or validation error.
     */
    private validateAndNormalizeInput(
        input: IGetRepositoryIndexInput,
    ): Result<INormalizedGetRepositoryIndexInput, ValidationError> {
        const fields = this.collectValidationErrors(input)
        if (fields.length > 0) {
            return Result.fail<INormalizedGetRepositoryIndexInput, ValidationError>(
                new ValidationError("Get repository index validation failed", fields),
            )
        }

        const normalizedRepoId = this.normalizeRepositoryId(input.repoId)
        if (normalizedRepoId.isFail) {
            return Result.fail<INormalizedGetRepositoryIndexInput, ValidationError>(
                normalizedRepoId.error,
            )
        }

        return Result.ok<INormalizedGetRepositoryIndexInput, ValidationError>({
            repoId: normalizedRepoId.value,
        })
    }

    /**
     * Collects shape and empty-value validation errors.
     *
     * @param input Incoming payload.
     * @returns Validation result.
     */
    private collectValidationErrors(
        input: IGetRepositoryIndexInput,
    ): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (typeof input.repoId !== "string" || input.repoId.trim().length === 0) {
            fields.push({
                field: "repoId",
                message: "must be a non-empty string",
            })
        }

        return fields
    }

    /**
     * Validates repository id format `<platform>:<id>`.
     *
     * @param repositoryId Raw repository id.
     * @returns Normalized repository id.
     */
    private normalizeRepositoryId(
        repositoryId: string,
    ): Result<string, ValidationError> {
        try {
            return Result.ok<string, ValidationError>(
                RepositoryId.parse(repositoryId).toString(),
            )
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<string, ValidationError>(
                    new ValidationError("Get repository index validation failed", [
                        {
                            field: "repoId",
                            message: "RepositoryId must match format <platform>:<id>",
                        },
                    ]),
                )
            }

            return Result.fail<string, ValidationError>(
                new ValidationError("Get repository index validation failed", [
                    {
                        field: "repoId",
                        message: "Invalid repositoryId",
                    },
                ]),
            )
        }
    }
}
