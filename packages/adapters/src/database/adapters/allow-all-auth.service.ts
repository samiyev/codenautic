/**
 * Authorization check input payload.
 */
export interface IAuthorizationCheckInput {
    readonly actorId?: string
    readonly organizationId?: string
    readonly repositoryId?: string
    readonly action?: string
}

/**
 * MVP authorization adapter that allows every action.
 */
export class AllowAllAuthService {
    /**
     * Creates service instance.
     */
    public constructor() {
    }

    /**
     * Returns allow decision for incoming check.
     *
     * @param _input Authorization payload.
     * @returns Always true.
     */
    public canAccess(_input: IAuthorizationCheckInput): Promise<boolean> {
        return Promise.resolve(true)
    }

    /**
     * Alias for access decision checks.
     *
     * @param input Authorization payload.
     * @returns Always true.
     */
    public authorize(input: IAuthorizationCheckInput): Promise<boolean> {
        return this.canAccess(input)
    }

    /**
     * Assertion-style authorization hook.
     *
     * @param _input Authorization payload.
     */
    public assertCanAccess(_input: IAuthorizationCheckInput): Promise<void> {
        return Promise.resolve()
    }
}
