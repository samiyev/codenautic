import {describe, expect, test} from "bun:test"

import {type IDomainEventBus} from "../../src/application/ports/outbound/domain-event-bus.port"
import {type IReviewRepository} from "../../src/application/ports/outbound/review-repository.port"
import {type IRuleRepository} from "../../src/application/ports/outbound/rule-repository.port"
import {createToken, TOKENS, type InjectionToken} from "../../src/index"

interface IExamplePort {
    ping(): string
}

describe("createToken", () => {
    test("returns symbol token with preserved generic type", () => {
        const token = createToken<IExamplePort>("example.port")
        const registry = new Map<InjectionToken<IExamplePort>, IExamplePort>()

        registry.set(token, {
            ping(): string {
                return "pong"
            },
        })

        const resolved = registry.get(token)

        expect(typeof token).toBe("symbol")
        expect(resolved?.ping()).toBe("pong")
    })

    test("creates unique tokens for the same description", () => {
        const first = createToken<IExamplePort>("duplicate-description")
        const second = createToken<IExamplePort>("duplicate-description")

        expect(first === second).toBe(false)
    })
})

describe("TOKENS", () => {
    test("exposes typed symbols for outbound core ports", () => {
        const reviewToken: InjectionToken<IReviewRepository> = TOKENS.Review.Repository
        const ruleToken: InjectionToken<IRuleRepository> = TOKENS.Rule.Repository
        const eventBusToken: InjectionToken<IDomainEventBus> = TOKENS.Common.DomainEventBus
        const reviewSymbol: symbol = reviewToken
        const ruleSymbol: symbol = ruleToken
        const eventBusSymbol: symbol = eventBusToken

        expect(typeof reviewToken).toBe("symbol")
        expect(typeof ruleToken).toBe("symbol")
        expect(typeof eventBusToken).toBe("symbol")
        expect(reviewSymbol === ruleSymbol).toBe(false)
        expect(reviewSymbol === eventBusSymbol).toBe(false)
        expect(ruleSymbol === eventBusSymbol).toBe(false)
    })
})
