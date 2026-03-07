import type {IDirectoryConfig as IDomainDirectoryConfig} from "../../../domain/value-objects/directory-config.value-object"
import type {IReviewConfigDTO} from "../review/review-config.dto"

/**
 * Directory-specific review configuration override.
 */
export type IDirectoryConfig = IDomainDirectoryConfig<Partial<IReviewConfigDTO>>
