import {describe, expect, test} from "bun:test"

import {type ITrelloProviderErrorDetails, TrelloProviderError} from "../../src/context/trello-provider.error"
import {
    TrelloProvider,
    type ITrelloApiClient,
    type ITrelloApiResponse,
    type ITrelloGetCardRequest,
    type ITrelloGetListRequest,
} from "../../src/context/trello-provider"

type TrelloCardPayload = Readonly<Record<string, unknown>>
type TrelloListPayload = Readonly<Record<string, unknown>>
type CardResponseQueueItem = ITrelloApiResponse<TrelloCardPayload> | Error
type ListResponseQueueItem = ITrelloApiResponse<TrelloListPayload> | Error

class StubTrelloApiClient implements ITrelloApiClient {
    public cardResponses: CardResponseQueueItem[] = []
    public listResponses: ListResponseQueueItem[] = []
    public cardCalls: ITrelloGetCardRequest[] = []
    public listCalls: ITrelloGetListRequest[] = []

    public getCard(request: ITrelloGetCardRequest): Promise<ITrelloApiResponse<TrelloCardPayload>> {
        this.cardCalls.push(request)
        const response = this.cardResponses.shift()
        if (response === undefined) {
            return Promise.reject(new Error("Missing stubbed card response"))
        }

        if (response instanceof Error) {
            return Promise.reject(response)
        }

        return Promise.resolve(response)
    }

    public getList(request: ITrelloGetListRequest): Promise<ITrelloApiResponse<TrelloListPayload>> {
        this.listCalls.push(request)
        const response = this.listResponses.shift()
        if (response === undefined) {
            return Promise.reject(new Error("Missing stubbed list response"))
        }

        if (response instanceof Error) {
            return Promise.reject(response)
        }

        return Promise.resolve(response)
    }
}

/**
 * Creates Trello card payload used by provider tests.
 *
 * @param overrides Optional payload overrides.
 * @returns Trello card payload.
 */
function createCardPayload(
    overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
    return {
        id: "card-991",
        name: "Sync review stage metadata",
        desc: "Keep Trello context adapter aligned with core DTO contracts.",
        due: "2026-03-20T00:00:00.000Z",
        closed: false,
        dueComplete: false,
        idList: "list-1",
        labels: [
            {
                id: "label-1",
                name: "review",
                color: "green",
            },
        ],
        members: [
            {
                id: "member-1",
                fullName: "Grace Hopper",
                username: "ghopper",
            },
        ],
        dateLastActivity: "2026-03-16T08:00:00.000Z",
        ...overrides,
    }
}

/**
 * Creates Trello list payload used by provider tests.
 *
 * @param overrides Optional payload overrides.
 * @returns Trello list payload.
 */
function createListPayload(
    overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
    return {
        id: "list-1",
        name: "In Progress",
        closed: false,
        ...overrides,
    }
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

describe("TrelloProvider", () => {
    test("loads Trello card and maps list members labels and due date", async () => {
        const client = new StubTrelloApiClient()
        client.cardResponses = [
            {
                status: 200,
                headers: {},
                data: createCardPayload(),
            },
        ]
        client.listResponses = [
            {
                status: 200,
                headers: {},
                data: createListPayload(),
            },
        ]
        const provider = new TrelloProvider({
            client,
        })

        const card = await provider.getCard("card-991")

        expect(card).toEqual({
            id: "card-991",
            title: "Sync review stage metadata",
            status: "open",
            description: "Keep Trello context adapter aligned with core DTO contracts.",
            dueDate: "2026-03-20T00:00:00.000Z",
            listName: "In Progress",
            labels: [
                {
                    id: "label-1",
                    name: "review",
                    color: "green",
                },
            ],
            members: [
                {
                    id: "member-1",
                    fullName: "Grace Hopper",
                    username: "ghopper",
                },
            ],
        })
        expect(client.cardCalls).toHaveLength(1)
        expect(client.cardCalls[0]?.cardId).toBe("card-991")
        expect(client.cardCalls[0]?.fields.length).toBeGreaterThan(0)
        expect(client.cardCalls[0]?.memberFields.length).toBeGreaterThan(0)
        expect(client.cardCalls[0]?.labelFields.length).toBeGreaterThan(0)
        expect(client.listCalls).toHaveLength(1)
        expect(client.listCalls[0]?.listId).toBe("list-1")
        expect(client.listCalls[0]?.fields.length).toBeGreaterThan(0)
    })

    test("loads shared external context for Trello card", async () => {
        const client = new StubTrelloApiClient()
        client.cardResponses = [
            {
                status: 200,
                headers: {},
                data: createCardPayload(),
            },
        ]
        client.listResponses = [
            {
                status: 200,
                headers: {},
                data: createListPayload(),
            },
        ]
        const provider = new TrelloProvider({
            client,
        })

        const context = await provider.loadContext("card-991")

        expect(context).toEqual({
            source: "TRELLO",
            data: {
                card: {
                    id: "card-991",
                    title: "Sync review stage metadata",
                    status: "open",
                    description: "Keep Trello context adapter aligned with core DTO contracts.",
                    dueDate: "2026-03-20T00:00:00.000Z",
                    listName: "In Progress",
                    labels: [
                        {
                            id: "label-1",
                            name: "review",
                            color: "green",
                        },
                    ],
                    members: [
                        {
                            id: "member-1",
                            fullName: "Grace Hopper",
                            username: "ghopper",
                        },
                    ],
                },
                listName: "In Progress",
                labels: [
                    "review",
                ],
            },
            fetchedAt: new Date("2026-03-16T08:00:00.000Z"),
        })
    })

    test("returns null when Trello card is not found", async () => {
        const client = new StubTrelloApiClient()
        client.cardResponses = [
            {
                status: 404,
                headers: {},
                data: {
                    message: "Not found",
                },
            },
        ]
        const provider = new TrelloProvider({
            client,
        })

        const card = await provider.getCard("missing-card")

        expect(card).toBeNull()
        expect(client.listCalls).toEqual([])
    })

    test("retries once on rate limit and respects retry-after header", async () => {
        const client = new StubTrelloApiClient()
        const sleepDelays: number[] = []
        client.cardResponses = [
            {
                status: 429,
                headers: {
                    "retry-after": "2",
                },
                data: {
                    message: "Rate limited",
                },
            },
            {
                status: 200,
                headers: {},
                data: createCardPayload(),
            },
        ]
        client.listResponses = [
            {
                status: 200,
                headers: {},
                data: createListPayload(),
            },
        ]
        const provider = new TrelloProvider({
            client,
            sleep: (delayMs: number): Promise<void> => {
                sleepDelays.push(delayMs)
                return Promise.resolve()
            },
        })

        const card = await provider.getCard("card-991")

        expect(card?.id).toBe("card-991")
        expect(client.cardCalls).toHaveLength(2)
        expect(sleepDelays).toEqual([2000])
    })

    test("retries transient list lookup failures while resolving context", async () => {
        const client = new StubTrelloApiClient()
        const sleepDelays: number[] = []
        client.cardResponses = [
            {
                status: 200,
                headers: {},
                data: createCardPayload(),
            },
        ]
        client.listResponses = [
            {
                status: 503,
                headers: {},
                data: {
                    message: "Temporary outage",
                },
            },
            {
                status: 200,
                headers: {},
                data: createListPayload(),
            },
        ]
        const provider = new TrelloProvider({
            client,
            sleep: (delayMs: number): Promise<void> => {
                sleepDelays.push(delayMs)
                return Promise.resolve()
            },
        })

        const context = await provider.loadContext("card-991")

        expect(context?.source).toBe("TRELLO")
        expect(client.listCalls).toHaveLength(2)
        expect(sleepDelays).toEqual([250])
    })

    test("throws non-retryable error for permission denied response", async () => {
        const client = new StubTrelloApiClient()
        const sleepDelays: number[] = []
        client.cardResponses = [
            {
                status: 401,
                headers: {},
                data: {
                    message: "Unauthorized",
                    code: "UNAUTHORIZED",
                },
            },
        ]
        const provider = new TrelloProvider({
            client,
            sleep: (delayMs: number): Promise<void> => {
                sleepDelays.push(delayMs)
                return Promise.resolve()
            },
        })

        try {
            await provider.getCard("card-991")
            throw new Error("Expected TrelloProviderError to be thrown")
        } catch (error: unknown) {
            expect(error).toMatchObject({
                name: "TrelloProviderError",
                message: "Unauthorized",
                code: "UNAUTHORIZED",
                statusCode: 401,
                isRetryable: false,
            } satisfies Partial<TrelloProviderError & ITrelloProviderErrorDetails>)
        }
        expect(sleepDelays).toEqual([])
    })

    test("uses internal fetch-backed Trello client with key and token query auth", async () => {
        const requests: Array<{
            readonly url: string
            readonly init: RequestInit | undefined
        }> = []
        const provider = new TrelloProvider({
            baseUrl: "https://api.trello.com",
            apiKey: "trello-key",
            token: "trello-token",
            fetchImplementation: asFetchImplementation((input, init) => {
                requests.push({
                    url: normalizeRequestTarget(input),
                    init,
                })

                if (requests.length === 1) {
                    return Promise.resolve(new Response(JSON.stringify(createCardPayload()), {
                        status: 200,
                        headers: {
                            "content-type": "application/json",
                        },
                    }))
                }

                return Promise.resolve(new Response(JSON.stringify(createListPayload()), {
                    status: 200,
                    headers: {
                        "content-type": "application/json",
                    },
                }))
            }),
        })

        const card = await provider.getCard("card-991")

        expect(card?.id).toBe("card-991")
        expect(requests).toHaveLength(2)
        expect(requests[0]?.url).toContain("https://api.trello.com/1/cards/card-991")
        expect(requests[0]?.url).toContain("key=trello-key")
        expect(requests[0]?.url).toContain("token=trello-token")
        expect(requests[1]?.url).toContain("https://api.trello.com/1/lists/list-1")
        expect(readRequestHeaders(requests[0]?.init)).toEqual({
            accept: "application/json",
        })
    })

    test("throws configuration errors when key or token are missing", () => {
        expect(() => {
            return new TrelloProvider({
                baseUrl: "https://api.trello.com",
                token: "trello-token",
            })
        }).toThrow("Trello apiKey is required when no client is provided")

        expect(() => {
            return new TrelloProvider({
                baseUrl: "https://api.trello.com",
                apiKey: "trello-key",
            })
        }).toThrow("Trello token is required when no client is provided")
    })
})
