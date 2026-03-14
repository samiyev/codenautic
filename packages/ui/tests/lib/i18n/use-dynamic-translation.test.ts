import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useDynamicTranslation } from "@/lib/i18n/use-dynamic-translation"

vi.mock("react-i18next", () => ({
    useTranslation: (namespaces?: string[]): { t: (key: string) => string } => ({
        t: (key: string): string =>
            `translated:${namespaces !== undefined ? namespaces.join(",") + ":" : ""}${key}`,
    }),
}))

describe("useDynamicTranslation", (): void => {
    it("when called without namespaces, then returns td function", (): void => {
        const { result } = renderHook(() => useDynamicTranslation())

        expect(typeof result.current.td).toBe("function")
    })

    it("when td is called with a key, then returns translated string", (): void => {
        const { result } = renderHook(() => useDynamicTranslation())

        const translated = result.current.td("some.key")

        expect(translated).toBe("translated:some.key")
    })

    it("when namespaces are provided, then passes them to useTranslation", (): void => {
        const { result } = renderHook(() =>
            useDynamicTranslation(["dashboard", "common"]),
        )

        const translated = result.current.td("metric.label")

        expect(translated).toBe("translated:dashboard,common:metric.label")
    })

    it("when td is called with options, then passes them through", (): void => {
        const { result } = renderHook(() => useDynamicTranslation())

        const translated = result.current.td("key", { count: 5 })

        expect(typeof translated).toBe("string")
    })

    it("when td is called multiple times, then always returns string", (): void => {
        const { result } = renderHook(() => useDynamicTranslation())

        const first = result.current.td("key.one")
        const second = result.current.td("key.two")

        expect(typeof first).toBe("string")
        expect(typeof second).toBe("string")
        expect(first).not.toBe(second)
    })
})
