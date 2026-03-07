import {createGitAclIdempotencyKey, type IGitAclIdempotencyInput} from "./git-acl-idempotency"

/**
 * Git ACL idempotency key builder.
 */
export class GitIdempotencyAcl {
    /**
     * Creates git idempotency ACL instance.
     */
    public constructor() {}

    /**
     * Builds deterministic idempotency key for git operation.
     *
     * @param input Idempotency source payload.
     * @returns Deterministic idempotency key.
     */
    public build(input: IGitAclIdempotencyInput): string {
        return createGitAclIdempotencyKey(input)
    }
}
