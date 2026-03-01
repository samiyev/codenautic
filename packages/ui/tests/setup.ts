import {afterEach} from "vitest"

afterEach((): void => {
    globalThis.fetch = undefined as unknown as typeof fetch
})
