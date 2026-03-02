import {cleanup} from "@testing-library/react"
import {afterAll, afterEach, beforeAll} from "vitest"

import {server} from "./mocks/server"

const originalFetch = globalThis.fetch

beforeAll((): void => {
    server.listen({
        onUnhandledRequest: "error",
    })
})

afterEach((): void => {
    cleanup()
    server.resetHandlers()
    globalThis.fetch = originalFetch
})

afterAll((): void => {
    server.close()
})
