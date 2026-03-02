import {describe, expect, test} from "bun:test"

import {Container} from "../../src/ioc/container"
import {createToken} from "../../src/ioc/create-token"

interface ICounterService {
    readonly id: string
}

describe("Container", () => {
    test("bind resolves transient as new instance each time", () => {
        const container = new Container()
        const counterToken = createToken<ICounterService>("counter.transient")

        container.bind(counterToken, () => {
            return {
                id: crypto.randomUUID(),
            }
        })

        const first = container.resolve(counterToken)
        const second = container.resolve(counterToken)

        expect(first.id).not.toBe(second.id)
    })

    test("bindSingleton resolves same cached instance", () => {
        const container = new Container()
        const counterToken = createToken<ICounterService>("counter.singleton")

        container.bindSingleton(counterToken, () => {
            return {
                id: crypto.randomUUID(),
            }
        })

        const first = container.resolve(counterToken)
        const second = container.resolve(counterToken)

        expect(first).toBe(second)
    })

    test("resolve throws when token is not registered", () => {
        const container = new Container()
        const missingToken = createToken<ICounterService>("counter.missing")

        expect(() => {
            container.resolve(missingToken)
        }).toThrow("No binding found for token")
    })

    test("has and unbind reflect registration state", () => {
        const container = new Container()
        const token = createToken<ICounterService>("counter.lifecycle")

        expect(container.has(token)).toBe(false)

        container.bind(token, () => {
            return {
                id: "instance",
            }
        })

        expect(container.has(token)).toBe(true)
        container.unbind(token)
        expect(container.has(token)).toBe(false)
    })
})
