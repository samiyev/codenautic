import {describe, expect, test} from "bun:test"

import {type ILinearProviderErrorDetails, LinearProviderError} from "../../src/context/linear-provider.error"
import {
    LinearProvider,
    type ILinearApiClient,
    type ILinearApiResponse,
    type ILinearGetIssueRequest,
    type ILinearGraphqlError,
    type ILinearIssueQueryResponse,
    type ILinearSearchIssuesPage,
    type ILinearSearchIssuesRequest,
} from "../../src/context/linear-provider"

type IssueResponseQueueItem = ILinearApiResponse<ILinearIssueQueryResponse> | Error
type SearchResponseQueueItem = ILinearApiResponse<ILinearSearchIssuesPage> | Error

class StubLinearApiClient implements ILinearApiClient {
    public issueResponses: IssueResponseQueueItem[] = []
    public searchResponses: SearchResponseQueueItem[] = []
    public issueCalls: ILinearGetIssueRequest[] = []
    public searchCalls: ILinearSearchIssuesRequest[] = []

    public getIssue(
        request: ILinearGetIssueRequest,
    ): Promise<ILinearApiResponse<ILinearIssueQueryResponse>> {
        this.issueCalls.push(request)
        const response = this.issueResponses.shift()
        if (response === undefined) {
            return Promise.reject(new Error("Missing stubbed issue response"))
        }

        if (response instanceof Error) {
            return Promise.reject(response)
        }

        return Promise.resolve(response)
    }

    public searchIssues(
        request: ILinearSearchIssuesRequest,
    ): Promise<ILinearApiResponse<ILinearSearchIssuesPage>> {
        this.searchCalls.push(request)
        const response = this.searchResponses.shift()
        if (response === undefined) {
            return Promise.reject(new Error("Missing stubbed search response"))
        }

        if (response instanceof Error) {
            return Promise.reject(response)
        }

        return Promise.resolve(response)
    }
}

/**
 * Creates GraphQL error payload used by Linear provider tests.
 *
 * @param overrides Optional error overrides.
 * @returns GraphQL error payload.
 */
function createGraphqlError(
    overrides: Partial<ILinearGraphqlError> = {},
): ILinearGraphqlError {
    return {
        message: "GraphQL field failed",
        path: [
            "issue",
            "project",
        ],
        extensions: {
            type: "GraphqlError",
            userError: false,
            userPresentableMessage: "GraphQL field failed",
        },
        ...overrides,
    }
}

/**
 * Creates Linear issue payload used by provider tests.
 *
 * @param overrides Optional payload overrides.
 * @returns Linear issue payload.
 */
function createIssuePayload(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
    return {
        identifier: "ENG-204",
        id: "issue-204",
        title: "Stabilize external context sync",
        description: "Provider should preserve project and child issue context from Linear.",
        priorityLabel: "High",
        state: {
            name: "In Progress",
            type: "started",
        },
        cycle: {
            name: "Cycle 14",
        },
        project: {
            id: "project-42",
            name: "Context Platform",
            description: "Keeps review enrichment adapters in sync.",
            state: "started",
            priorityLabel: "Urgent",
        },
        children: {
            nodes: [
                {
                    identifier: "ENG-205",
                    id: "issue-205",
                    title: "Map child issue priority",
                    priority: 3,
                    state: {
                        name: "Todo",
                    },
                },
            ],
        },
        ...overrides,
    }
}

/**
 * Casts async fetch stub to Bun-compatible fetch type.
 *
 * @param implementation Fetch stub implementation.
 * @returns Typed fetch implementation.
 */
function asFetchImplementation(
    implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
    return implementation as typeof fetch
}

/**
 * Reads plain headers record from RequestInit.
 *
 * @param init Fetch init payload.
 * @returns Lower-cased headers record.
 */
function readRequestHeaders(init: RequestInit | undefined): Readonly<Record<string, string>> {
    const source = init?.headers
    if (source === undefined || source instanceof Headers) {
        return {}
    }

    if (Array.isArray(source)) {
        return Object.fromEntries(
            source.map(([key, value]) => {
                return [key.toLowerCase(), value]
            }),
        )
    }

    return Object.fromEntries(
        Object.entries(source).map(([key, value]) => {
            return [key.toLowerCase(), String(value)]
        }),
    )
}

/**
 * Normalizes fetch target into stable string URL.
 *
 * @param input Fetch target.
 * @returns Stable request URL.
 */
function normalizeRequestTarget(input: RequestInfo | URL): string {
    if (typeof input === "string") {
        return input
    }

    if (input instanceof URL) {
        return input.toString()
    }

    return input.url
}

/**
 * Reads string request body from RequestInit when available.
 *
 * @param init Fetch init payload.
 * @returns String body or empty string.
 */
function readRequestBody(init: RequestInit | undefined): string {
    return typeof init?.body === "string" ? init.body : ""
}

describe("LinearProvider", () => {
    test("loads Linear issue and maps description, priority, cycle, project and sub-issues", async () => {
        const client = new StubLinearApiClient()
        client.issueResponses = [
            {
                status: 200,
                headers: {},
                data: {
                    issue: createIssuePayload(),
                },
            },
        ]
        const provider = new LinearProvider({
            client,
        })

        const issue = await provider.getIssue("ENG-204")

        expect(issue).toEqual({
            id: "ENG-204",
            title: "Stabilize external context sync",
            state: "In Progress",
            description: "Provider should preserve project and child issue context from Linear.",
            priority: "High",
            cycle: "Cycle 14",
            project: {
                id: "project-42",
                name: "Context Platform",
                description: "Keeps review enrichment adapters in sync.",
                state: "started",
                priority: "Urgent",
            },
            subIssues: [
                {
                    id: "ENG-205",
                    title: "Map child issue priority",
                    state: "Todo",
                    priority: "Normal",
                },
            ],
        })
        expect(client.issueCalls).toEqual([
            {
                id: "ENG-204",
            },
        ])
    })

    test("keeps usable partial data when GraphQL errors affect nested fields only", async () => {
        const client = new StubLinearApiClient()
        client.issueResponses = [
            {
                status: 200,
                headers: {},
                data: {
                    issue: createIssuePayload({
                        project: null,
                    }),
                },
                errors: [
                    createGraphqlError({
                        path: [
                            "issue",
                            "project",
                        ],
                    }),
                ],
            },
        ]
        const provider = new LinearProvider({
            client,
        })

        const context = await provider.loadContext("ENG-204")

        expect(context).toEqual({
            source: "LINEAR",
            data: {
                issue: {
                    id: "ENG-204",
                    title: "Stabilize external context sync",
                    state: "In Progress",
                    description: "Provider should preserve project and child issue context from Linear.",
                    priority: "High",
                    cycle: "Cycle 14",
                    subIssues: [
                        {
                            id: "ENG-205",
                            title: "Map child issue priority",
                            state: "Todo",
                            priority: "Normal",
                        },
                    ],
                },
                cycle: "Cycle 14",
                subIssues: [
                    {
                        id: "ENG-205",
                        title: "Map child issue priority",
                        state: "Todo",
                        priority: "Normal",
                    },
                ],
            },
            fetchedAt: new Date(0),
        })
    })

    test("falls back to paginated search when direct issue lookup returns no issue", async () => {
        const client = new StubLinearApiClient()
        client.issueResponses = [
            {
                status: 200,
                headers: {},
                data: {
                    issue: null,
                },
            },
        ]
        client.searchResponses = [
            {
                status: 200,
                headers: {},
                data: {
                    searchIssues: {
                        nodes: [
                            {
                                identifier: "ENG-999",
                                title: "Different issue",
                                state: {
                                    name: "Done",
                                },
                            },
                        ],
                        pageInfo: {
                            hasNextPage: true,
                            endCursor: "cursor-1",
                        },
                    },
                },
            },
            {
                status: 200,
                headers: {},
                data: {
                    searchIssues: {
                        nodes: [
                            createIssuePayload(),
                        ],
                        pageInfo: {
                            hasNextPage: false,
                            endCursor: null,
                        },
                    },
                },
            },
        ]
        const provider = new LinearProvider({
            client,
            searchPageSize: 1,
        })

        const issue = await provider.getIssue("ENG-204")

        expect(issue?.id).toBe("ENG-204")
        expect(client.searchCalls).toEqual([
            {
                term: "ENG-204",
                first: 1,
            },
            {
                term: "ENG-204",
                first: 1,
                after: "cursor-1",
            },
        ])
    })

    test("uses internal fetch-backed client with bearer auth and search fallback", async () => {
        const requests: Array<{
            readonly target: string
            readonly headers: Readonly<Record<string, string>>
            readonly body: string
        }> = []
        const fetchResponses = [
            new Response(
                JSON.stringify({
                    data: {
                        issue: null,
                    },
                }),
                {
                    status: 200,
                    headers: {
                        "x-trace-id": "direct",
                    },
                },
            ),
            new Response(
                JSON.stringify({
                    data: {
                        searchIssues: {
                            nodes: [
                                {
                                    id: "issue-404",
                                    title: "Search by raw id",
                                    state: {
                                        name: "Todo",
                                    },
                                },
                            ],
                            pageInfo: {
                                hasNextPage: false,
                            },
                        },
                    },
                }),
                {
                    status: 200,
                    headers: {
                        "x-trace-id": "search",
                    },
                },
            ),
        ]
        const provider = new LinearProvider({
            apiKey: "linear-token",
            fetchImplementation: asFetchImplementation(
                (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                    requests.push({
                        target: normalizeRequestTarget(input),
                        headers: readRequestHeaders(init),
                        body: readRequestBody(init),
                    })
                    const response = fetchResponses.shift()
                    if (response === undefined) {
                        throw new Error("Missing stubbed fetch response")
                    }

                    return Promise.resolve(response)
                },
            ),
        })

        const issue = await provider.getIssue("issue-404")

        expect(issue).toEqual({
            id: "issue-404",
            title: "Search by raw id",
            state: "Todo",
        })
        expect(requests).toHaveLength(2)
        expect(requests[0]?.target).toBe("https://api.linear.app/graphql")
        expect(requests[0]?.headers["authorization"]).toBe("Bearer linear-token")
        expect(requests[0]?.body).toContain("ContextLinearIssue")
        expect(requests[1]?.body).toContain("ContextLinearSearchIssues")
    })

    test("returns null for 404 lookup and tolerates empty or invalid JSON fetch responses", async () => {
        const fetchResponses = [
            new Response(
                JSON.stringify({
                    errors: [
                        createGraphqlError({
                            message: "Issue not found",
                            extensions: {
                                type: "GraphqlError",
                                userError: false,
                                userPresentableMessage: "Issue not found",
                            },
                        }),
                    ],
                }),
                {
                    status: 404,
                },
            ),
            new Response("", {
                status: 200,
            }),
            new Response("not-json", {
                status: 200,
            }),
            new Response("", {
                status: 200,
            }),
        ]
        const provider = new LinearProvider({
            accessToken: "secret-token",
            fetchImplementation: asFetchImplementation(
                (): Promise<Response> => {
                    const response = fetchResponses.shift()
                    if (response === undefined) {
                        throw new Error("Missing stubbed fetch response")
                    }

                    return Promise.resolve(response)
                },
            ),
        })

        const firstIssue = await provider.getIssue("ENG-404")
        const secondIssue = await provider.getIssue("ENG-405")

        expect(firstIssue).toBeNull()
        expect(secondIssue).toBeNull()
    })

    test("throws typed GraphQL error when upstream returns unusable data with errors", () => {
        const client = new StubLinearApiClient()
        client.issueResponses = [
            {
                status: 200,
                headers: {
                    "retry-after": "3",
                },
                errors: [
                    createGraphqlError({
                        message: "Issue query failed",
                        path: [
                            "issue",
                        ],
                        extensions: {
                            type: "GraphqlError",
                            userError: false,
                            userPresentableMessage: "Issue query failed",
                        },
                    }),
                ],
            },
        ]
        const provider = new LinearProvider({
            client,
        })

        expect(provider.getIssue("ENG-204")).rejects.toMatchObject({
            name: "LinearProviderError",
            statusCode: 200,
            code: "GraphqlError",
            retryAfterMs: 3000,
            isRetryable: false,
            graphqlPaths: [
                "issue",
            ],
            hasPartialData: false,
        } satisfies Partial<LinearProviderError>)
    })

    test("retries once on rate limit and respects retry-after header", async () => {
        const client = new StubLinearApiClient()
        const sleepDelays: number[] = []
        client.issueResponses = [
            {
                status: 429,
                headers: {
                    "retry-after": "1",
                },
                errors: [
                    createGraphqlError({
                        message: "Rate limited",
                        extensions: {
                            type: "Ratelimited",
                            userError: false,
                            userPresentableMessage: "Rate limited",
                        },
                    }),
                ],
            },
            {
                status: 200,
                headers: {},
                data: {
                    issue: createIssuePayload(),
                },
            },
        ]
        const provider = new LinearProvider({
            client,
            sleep: (delayMs: number): Promise<void> => {
                sleepDelays.push(delayMs)
                return Promise.resolve()
            },
        })

        const issue = await provider.getIssue("ENG-204")

        expect(issue?.id).toBe("ENG-204")
        expect(client.issueCalls).toHaveLength(2)
        expect(sleepDelays).toEqual([1000])
    })

    test("uses default sleep implementation for retryable internal rate limits", async () => {
        const fetchResponses = [
            new Response(
                JSON.stringify({
                    errors: [
                        createGraphqlError({
                            message: "Rate limited",
                            extensions: {
                                type: "Ratelimited",
                                userError: false,
                                userPresentableMessage: "Rate limited",
                            },
                        }),
                    ],
                }),
                {
                    status: 429,
                    headers: {
                        "retry-after": "0.001",
                    },
                },
            ),
            new Response(
                JSON.stringify({
                    data: {
                        issue: createIssuePayload(),
                    },
                }),
                {
                    status: 200,
                },
            ),
        ]
        const provider = new LinearProvider({
            apiKey: "linear-token",
            fetchImplementation: asFetchImplementation(
                (): Promise<Response> => {
                    const response = fetchResponses.shift()
                    if (response === undefined) {
                        throw new Error("Missing stubbed fetch response")
                    }

                    return Promise.resolve(response)
                },
            ),
        })

        const issue = await provider.getIssue("ENG-204")

        expect(issue?.id).toBe("ENG-204")
    })

    test("throws non-retryable typed error for forbidden response", () => {
        const client = new StubLinearApiClient()
        client.issueResponses = [
            {
                status: 403,
                headers: {},
                errors: [
                    createGraphqlError({
                        message: "Forbidden",
                        extensions: {
                            type: "Forbidden",
                            userError: false,
                            userPresentableMessage: "Forbidden",
                        },
                    }),
                ],
            },
        ]
        const provider = new LinearProvider({
            client,
        })

        expect(provider.getIssue("ENG-204")).rejects.toMatchObject({
            name: "LinearProviderError",
            statusCode: 403,
            code: "Forbidden",
            isRetryable: false,
        } satisfies Partial<LinearProviderError>)
    })

    test("throws configuration error when no token or client is provided", () => {
        expect(() => {
            return new LinearProvider({})
        }).toThrow(
            new LinearProviderError("Linear apiKey or accessToken is required when no client is provided", {
                code: "CONFIGURATION",
                isRetryable: false,
            } satisfies ILinearProviderErrorDetails),
        )
    })
})
