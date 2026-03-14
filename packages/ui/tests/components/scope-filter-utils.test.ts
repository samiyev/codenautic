import { describe, expect, it, vi } from "vitest"

import { createScopeChangeHandler } from "@/components/dashboard/scope-filter-utils"

describe("createScopeChangeHandler", (): void => {
    it("when selection contains a key, then calls callback with that key", (): void => {
        const callback = vi.fn()
        const handler = createScopeChangeHandler<string>(callback)

        handler("repository")

        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith("repository")
    })

    it("when selection is null, then does not call callback", (): void => {
        const callback = vi.fn()
        const handler = createScopeChangeHandler<string>(callback)

        handler(null)

        expect(callback).not.toHaveBeenCalled()
    })

    it("when selection is a numeric key, then calls callback with string value", (): void => {
        const callback = vi.fn()
        const handler = createScopeChangeHandler<string>(callback)

        handler(42)

        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith("42")
    })

    it("when used with typed scope values, then preserves type narrowing", (): void => {
        type TScopeFilter = "org" | "repo" | "team"
        const callback = vi.fn()
        const handler = createScopeChangeHandler<TScopeFilter>(callback)

        handler("team")

        expect(callback).toHaveBeenCalledWith("team")
    })
})
