import type {IAntiCorruptionLayer} from "@codenautic/core"

import {
    normalizeGitAclError,
    shouldRetryGitAclError,
    type INormalizedGitAclError,
} from "./git-acl-error"

/**
 * Git ACL error normalization adapter.
 */
export class GitErrorAcl implements IAntiCorruptionLayer<unknown, INormalizedGitAclError> {
    /**
     * Creates git error ACL instance.
     */
    public constructor() {}

    /**
     * Normalizes provider error to canonical ACL error payload.
     *
     * @param external Raw provider error.
     * @returns Canonical ACL error.
     */
    public toDomain(external: unknown): INormalizedGitAclError {
        return normalizeGitAclError(external)
    }

    /**
     * Checks retry eligibility for provider error.
     *
     * @param external Raw provider error.
     * @param attempt Current attempt number.
     * @param maxAttempts Maximum attempts.
     * @returns True when retry should be attempted.
     */
    public shouldRetry(external: unknown, attempt: number, maxAttempts: number): boolean {
        return shouldRetryGitAclError(external, attempt, maxAttempts)
    }
}
