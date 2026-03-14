import {describe, expect, test} from "bun:test"

import type {IGitProvider, IMergeRequestDTO} from "@codenautic/core"

import {
    GIT_RATE_LIMIT_REASON,
    GIT_RATE_LIMIT_TIER,
    withGitRateLimit,
} from "../../src/git"
import {createGitProviderMock} from "../helpers/provider-factories"

/**
 * Virtual clock with controllable current time and async sleep.
 */
interface IVirtualClock {
    /**
     * Returns current virtual timestamp in milliseconds.
     *
     * @returns Virtual timestamp.
     */
    readonly now: () => number

    /**
     * Advances virtual time by requested delay.
     *
     * @param delayMs Delay in milliseconds.
     * @returns Completion promise.
     */
    readonly sleep: (delayMs: number) => Promise<void>

    /**
     * Captured sleep delays.
     */
    readonly delays: number[]
}

/**
 * Creates virtual clock helper for deterministic limiter tests.
 *
 * @param initialMs Initial timestamp.
 * @returns Virtual clock facade.
 */
function createVirtualClock(initialMs = 0): IVirtualClock {
    let currentMs = initialMs
    const delays: number[] = []

    return {
        now(): number {
            return currentMs
        },
        sleep(delayMs: number): Promise<void> {
            delays.push(delayMs)
            currentMs += delayMs
            return Promise.resolve()
        },
        delays,
    }
}

/**
 * Creates provider double with custom merge-request handler.
 *
 * @param handler Merge-request handler.
 * @returns Git provider double.
 */
function createRecordingProvider(
    handler: (id: string) => Promise<IMergeRequestDTO>,
): IGitProvider {
    return {
        ...createGitProviderMock(),
        getMergeRequest(id: string): Promise<IMergeRequestDTO> {
            return handler(id)
        },
    }
}

describe("withGitRateLimit", () => {
    test("throttles requests when free tier quota is exhausted within one window", async () => {
        const clock = createVirtualClock()
        const calls: string[] = []
        const provider = createRecordingProvider((id: string): Promise<IMergeRequestDTO> => {
            calls.push(id)
            return Promise.resolve({id} as IMergeRequestDTO)
        })
        const rateLimited = withGitRateLimit(provider, {
            organizationId: "org-free-quota",
            tier: GIT_RATE_LIMIT_TIER.FREE,
            freeTierLimit: 2,
            windowMs: 1_000,
            now: clock.now,
            sleep: clock.sleep,
        })

        await rateLimited.getMergeRequest("mr-1")
        await rateLimited.getMergeRequest("mr-2")
        await rateLimited.getMergeRequest("mr-3")

        expect(calls).toEqual([
            "mr-1",
            "mr-2",
            "mr-3",
        ])
        expect(clock.delays).toEqual([1_000])
    })

    test("uses pro tier quota when tier is PRO", async () => {
        const clock = createVirtualClock()
        const calls: string[] = []
        const provider = createRecordingProvider((id: string): Promise<IMergeRequestDTO> => {
            calls.push(id)
            return Promise.resolve({id} as IMergeRequestDTO)
        })
        const rateLimited = withGitRateLimit(provider, {
            organizationId: "org-pro-quota",
            tier: GIT_RATE_LIMIT_TIER.PRO,
            freeTierLimit: 1,
            proTierLimit: 3,
            windowMs: 500,
            now: clock.now,
            sleep: clock.sleep,
        })

        await rateLimited.getMergeRequest("mr-1")
        await rateLimited.getMergeRequest("mr-2")
        await rateLimited.getMergeRequest("mr-3")
        await rateLimited.getMergeRequest("mr-4")

        expect(calls).toEqual([
            "mr-1",
            "mr-2",
            "mr-3",
            "mr-4",
        ])
        expect(clock.delays).toEqual([500])
    })

    test("tracks quotas independently for different organizations", async () => {
        const firstClock = createVirtualClock()
        const secondClock = createVirtualClock()
        const calls: string[] = []
        const provider = createRecordingProvider((id: string): Promise<IMergeRequestDTO> => {
            calls.push(id)
            return Promise.resolve({id} as IMergeRequestDTO)
        })
        const firstOrganization = withGitRateLimit(provider, {
            organizationId: "org-a",
            tier: GIT_RATE_LIMIT_TIER.FREE,
            freeTierLimit: 1,
            windowMs: 2_000,
            now: firstClock.now,
            sleep: firstClock.sleep,
        })
        const secondOrganization = withGitRateLimit(provider, {
            organizationId: "org-b",
            tier: GIT_RATE_LIMIT_TIER.FREE,
            freeTierLimit: 1,
            windowMs: 2_000,
            now: secondClock.now,
            sleep: secondClock.sleep,
        })

        await firstOrganization.getMergeRequest("org-a-first")
        await secondOrganization.getMergeRequest("org-b-first")
        await firstOrganization.getMergeRequest("org-a-second")
        await secondOrganization.getMergeRequest("org-b-second")

        expect(calls).toEqual([
            "org-a-first",
            "org-b-first",
            "org-a-second",
            "org-b-second",
        ])
        expect(firstClock.delays).toEqual([2_000])
        expect(secondClock.delays).toEqual([2_000])
    })

    test("queues parallel requests for one organization without dropping calls", async () => {
        const clock = createVirtualClock()
        const calls: string[] = []
        const provider = createRecordingProvider((id: string): Promise<IMergeRequestDTO> => {
            calls.push(id)
            return Promise.resolve({id} as IMergeRequestDTO)
        })
        const rateLimited = withGitRateLimit(provider, {
            organizationId: "org-queue",
            tier: GIT_RATE_LIMIT_TIER.FREE,
            freeTierLimit: 1,
            windowMs: 1_000,
            now: clock.now,
            sleep: clock.sleep,
        })

        await Promise.all([
            rateLimited.getMergeRequest("parallel-1"),
            rateLimited.getMergeRequest("parallel-2"),
        ])

        expect(calls).toEqual([
            "parallel-1",
            "parallel-2",
        ])
        expect(clock.delays).toEqual([1_000])
    })

    test("handles provider 429 by throttling and retrying request", async () => {
        const clock = createVirtualClock()
        const throttleReasons: string[] = []
        let attempts = 0
        const provider = createRecordingProvider((_id: string): Promise<IMergeRequestDTO> => {
            attempts += 1
            if (attempts === 1) {
                const rateLimitedError = new Error("rate limited") as Error & {
                    statusCode: number
                    retryAfterMs: number
                }
                rateLimitedError.statusCode = 429
                rateLimitedError.retryAfterMs = 250
                return Promise.reject(rateLimitedError)
            }

            return Promise.resolve({id: "mr-429"} as IMergeRequestDTO)
        })
        const rateLimited = withGitRateLimit(provider, {
            organizationId: "org-429",
            tier: GIT_RATE_LIMIT_TIER.PRO,
            proTierLimit: 100,
            windowMs: 5_000,
            now: clock.now,
            sleep: clock.sleep,
            onThrottle: (event): void => {
                throttleReasons.push(event.reason)
            },
        })

        const result = await rateLimited.getMergeRequest("mr-429")

        expect(result.id).toBe("mr-429")
        expect(attempts).toBe(2)
        expect(clock.delays).toEqual([250])
        expect(throttleReasons).toEqual([GIT_RATE_LIMIT_REASON.ProviderRateLimited])
    })
})
