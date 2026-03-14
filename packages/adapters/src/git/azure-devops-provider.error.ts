import type {GitAclErrorKind, INormalizedGitAclError} from "./acl"

/**
 * Typed error codes for Azure DevOps provider failures.
 */
export const AZURE_DEVOPS_PROVIDER_ERROR_CODE = {
    API_REQUEST_FAILED: "API_REQUEST_FAILED",
    UNSUPPORTED_OPERATION: "UNSUPPORTED_OPERATION",
} as const

/**
 * Azure DevOps provider error code literal.
 */
export type AzureDevOpsProviderErrorCode =
    (typeof AZURE_DEVOPS_PROVIDER_ERROR_CODE)[keyof typeof AZURE_DEVOPS_PROVIDER_ERROR_CODE]

/**
 * Structured metadata for Azure DevOps provider failures.
 */
export interface IAzureDevOpsProviderErrorDetails {
    /**
     * Operation name associated with the failure.
     */
    readonly operation?: string

    /**
     * Optional unsupported capability label.
     */
    readonly capability?: string

    /**
     * Normalized ACL failure payload when request reached the provider.
     */
    readonly normalized?: INormalizedGitAclError
}

type IAzureDevOpsProviderErrorMessageBuilder = (
    details: IAzureDevOpsProviderErrorDetails,
) => string

const AZURE_DEVOPS_PROVIDER_ERROR_MESSAGES: Readonly<
    Record<AzureDevOpsProviderErrorCode, IAzureDevOpsProviderErrorMessageBuilder>
> = {
    [AZURE_DEVOPS_PROVIDER_ERROR_CODE.API_REQUEST_FAILED]: (
        details: IAzureDevOpsProviderErrorDetails,
    ): string => {
        return details.normalized?.message ?? "Azure DevOps git request failed"
    },
    [AZURE_DEVOPS_PROVIDER_ERROR_CODE.UNSUPPORTED_OPERATION]: (
        details: IAzureDevOpsProviderErrorDetails,
    ): string => {
        const operation = details.operation ?? "<unknown>"
        return `Azure DevOps provider does not support operation: ${operation}`
    },
}

/**
 * Typed error raised by Azure DevOps provider.
 */
export class AzureDevOpsProviderError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AzureDevOpsProviderErrorCode

    /**
     * Operation name associated with the failure.
     */
    public readonly operation?: string

    /**
     * Optional unsupported capability label.
     */
    public readonly capability?: string

    /**
     * Normalized ACL failure payload when available.
     */
    public readonly normalized?: INormalizedGitAclError

    /**
     * Creates typed Azure DevOps provider error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AzureDevOpsProviderErrorCode,
        details: IAzureDevOpsProviderErrorDetails = {},
    ) {
        super(buildAzureDevOpsProviderErrorMessage(code, details))

        this.name = "AzureDevOpsProviderError"
        this.code = code
        this.operation = details.operation
        this.capability = details.capability
        this.normalized = details.normalized
    }

    /**
     * Retryable flag derived from normalized error payload.
     *
     * @returns True when the failed request may be retried.
     */
    public get isRetryable(): boolean {
        return this.normalized?.isRetryable ?? false
    }

    /**
     * Normalized ACL error kind when available.
     *
     * @returns Canonical git ACL error kind or undefined.
     */
    public get kind(): GitAclErrorKind | undefined {
        return this.normalized?.kind
    }

    /**
     * Optional HTTP status code from normalized ACL payload.
     *
     * @returns Status code or undefined.
     */
    public get statusCode(): number | undefined {
        return this.normalized?.statusCode
    }

    /**
     * Optional retry-after hint from normalized ACL payload.
     *
     * @returns Delay in milliseconds or undefined.
     */
    public get retryAfterMs(): number | undefined {
        return this.normalized?.retryAfterMs
    }
}

/**
 * Builds stable public message for Azure DevOps provider failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public error message.
 */
function buildAzureDevOpsProviderErrorMessage(
    code: AzureDevOpsProviderErrorCode,
    details: IAzureDevOpsProviderErrorDetails,
): string {
    return AZURE_DEVOPS_PROVIDER_ERROR_MESSAGES[code](details)
}
