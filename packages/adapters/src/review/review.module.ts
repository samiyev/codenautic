import {
    Container,
    TOKENS,
    type IPipelineCheckpointStore,
    type IReviewRepository,
} from "@codenautic/core"

import {bindConstantSingleton} from "../shared/bind-constant-singleton"

/**
 * Registration options for review adapter module.
 */
export interface IRegisterReviewModuleOptions {
    /**
     * Review repository implementation.
     */
    readonly repository: IReviewRepository

    /**
     * Optional checkpoint store implementation.
     */
    readonly pipelineCheckpointStore?: IPipelineCheckpointStore
}

/**
 * Registers review adapters in DI container.
 *
 * @param container Target container.
 * @param options Module options.
 */
export function registerReviewModule(
    container: Container,
    options: IRegisterReviewModuleOptions,
): void {
    bindConstantSingleton(container, TOKENS.Review.Repository, options.repository)

    if (options.pipelineCheckpointStore !== undefined) {
        bindConstantSingleton(
            container,
            TOKENS.Review.PipelineCheckpointStore,
            options.pipelineCheckpointStore,
        )
    }
}
