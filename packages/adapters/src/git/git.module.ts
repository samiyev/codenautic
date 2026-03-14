import {
    Container,
    type IGitPipelineStatusProvider,
    type IGitProvider,
    type IRepositoryWorkspaceProvider,
} from "@codenautic/core"

import {bindConstantSingleton} from "../shared/bind-constant-singleton"
import type {IGitProviderFactory} from "./git-provider.factory"
import {GIT_TOKENS} from "./git.tokens"

/**
 * Registration options for git adapter module.
 */
export interface IRegisterGitModuleOptions {
    /**
     * Git provider implementation.
     */
    readonly provider: IGitProvider

    /**
     * Optional external pipeline status provider.
     */
    readonly pipelineStatusProvider?: IGitPipelineStatusProvider

    /**
     * Optional git provider factory.
     */
    readonly providerFactory?: IGitProviderFactory

    /**
     * Optional repository workspace provider.
     */
    readonly repositoryWorkspaceProvider?: IRepositoryWorkspaceProvider
}

/**
 * Registers git adapters in DI container.
 *
 * @param container Target container.
 * @param options Module options.
 */
export function registerGitModule(container: Container, options: IRegisterGitModuleOptions): void {
    bindConstantSingleton(container, GIT_TOKENS.Blame, options.provider)
    bindConstantSingleton(container, GIT_TOKENS.Provider, options.provider)
    const pipelineStatusProvider = resolvePipelineStatusProvider(options)

    if (pipelineStatusProvider !== undefined) {
        bindConstantSingleton(
            container,
            GIT_TOKENS.PipelineStatus,
            pipelineStatusProvider,
        )
    }

    if (options.providerFactory !== undefined) {
        bindConstantSingleton(
            container,
            GIT_TOKENS.ProviderFactory,
            options.providerFactory,
        )
    }

    if (options.repositoryWorkspaceProvider !== undefined) {
        bindConstantSingleton(
            container,
            GIT_TOKENS.RepositoryWorkspaceProvider,
            options.repositoryWorkspaceProvider,
        )
    }
}

/**
 * Resolves pipeline-status provider from explicit options or multi-capability provider.
 *
 * @param options Git module registration options.
 * @returns Pipeline status provider when available.
 */
function resolvePipelineStatusProvider(
    options: IRegisterGitModuleOptions,
): IGitPipelineStatusProvider | undefined {
    if (options.pipelineStatusProvider !== undefined) {
        return options.pipelineStatusProvider
    }

    if (isGitPipelineStatusProvider(options.provider)) {
        return options.provider
    }

    return undefined
}

/**
 * Type guard for providers implementing the pipeline-status contract.
 *
 * @param value Candidate provider.
 * @returns True when provider exposes pipeline-status methods.
 */
function isGitPipelineStatusProvider(
    value: IGitProvider,
): value is IGitProvider & IGitPipelineStatusProvider {
    const candidate = value as unknown as Readonly<Record<string, unknown>>

    return (
        typeof candidate["createPipelineStatus"] === "function" &&
        typeof candidate["updatePipelineStatus"] === "function"
    )
}
