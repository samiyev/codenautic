import { beforeEach, describe, expect, it } from "vitest"

import {
    buildSearchFromRoute,
    readPersistedReviewsFilters,
    REVIEWS_FILTER_PERSISTENCE_KEY,
    sanitizeForRouter,
    validateReviewsSearch,
} from "@/routes/reviews"

describe("reviews route filters", (): void => {
    beforeEach((): void => {
        localStorage.removeItem(REVIEWS_FILTER_PERSISTENCE_KEY)
    })

    it("восстанавливает persisted filters, когда URL-параметры не заданы", (): void => {
        localStorage.setItem(
            REVIEWS_FILTER_PERSISTENCE_KEY,
            JSON.stringify({
                repository: "frontend-team/ui-dashboard",
                search: "risk",
                status: "in_progress",
                team: "frontend",
            }),
        )

        const actual = buildSearchFromRoute({})

        expect(actual).toEqual({
            repository: "frontend-team/ui-dashboard",
            search: "risk",
            status: "in_progress",
            team: "frontend",
        })
    })

    it("приоритетно использует URL-параметры, если они заданы", (): void => {
        localStorage.setItem(
            REVIEWS_FILTER_PERSISTENCE_KEY,
            JSON.stringify({
                repository: "frontend-team/ui-dashboard",
                search: "stale",
                status: "rejected",
                team: "frontend",
            }),
        )

        const actual = buildSearchFromRoute({
            q: "approved",
            repo: "platform-team/api-gateway",
            status: "approved",
            team: "platform",
        })

        expect(actual).toEqual({
            repository: "platform-team/api-gateway",
            search: "approved",
            status: "approved",
            team: "platform",
        })
    })

    it("очищает дефолтные значения при сериализации фильтров в URL", (): void => {
        const actual = sanitizeForRouter({
            repository: "all",
            search: "",
            status: "all",
            team: "all",
        })

        expect(actual).toEqual({
            q: undefined,
            repo: undefined,
            status: undefined,
            team: undefined,
        })
    })

    it("синхронизирует фильтры через URL и поддерживает shareable round-trip", (): void => {
        const originalFilters = {
            repository: "platform-team/api-gateway",
            search: "security regression",
            status: "in_progress",
            team: "platform",
        } as const

        const routeSearch = sanitizeForRouter(originalFilters)
        const restored = buildSearchFromRoute(routeSearch)

        expect(routeSearch).toEqual({
            q: "security regression",
            repo: "platform-team/api-gateway",
            status: "in_progress",
            team: "platform",
        })

        expect(restored).toEqual(originalFilters)
    })
})

describe("readPersistedReviewsFilters", (): void => {
    beforeEach((): void => {
        localStorage.removeItem(REVIEWS_FILTER_PERSISTENCE_KEY)
    })

    it("when no persisted filters, then returns null", (): void => {
        expect(readPersistedReviewsFilters()).toBeNull()
    })

    it("when valid persisted filters, then returns parsed filters", (): void => {
        localStorage.setItem(
            REVIEWS_FILTER_PERSISTENCE_KEY,
            JSON.stringify({
                repository: "org/repo",
                search: "test",
                status: "open",
                team: "dev",
            }),
        )

        const result = readPersistedReviewsFilters()

        expect(result).toEqual({
            repository: "org/repo",
            search: "test",
            status: "open",
            team: "dev",
        })
    })

    it("when invalid JSON stored, then returns null", (): void => {
        localStorage.setItem(REVIEWS_FILTER_PERSISTENCE_KEY, "not-json{")

        expect(readPersistedReviewsFilters()).toBeNull()
    })

    it("when stored filters have empty strings, then uses defaults", (): void => {
        localStorage.setItem(
            REVIEWS_FILTER_PERSISTENCE_KEY,
            JSON.stringify({
                repository: "",
                search: "",
                status: "",
                team: "",
            }),
        )

        const result = readPersistedReviewsFilters()

        expect(result).toEqual({
            repository: "all",
            search: "",
            status: "all",
            team: "all",
        })
    })

    it("when stored filters have non-string values, then uses defaults", (): void => {
        localStorage.setItem(
            REVIEWS_FILTER_PERSISTENCE_KEY,
            JSON.stringify({
                repository: 42,
                search: null,
                status: undefined,
                team: true,
            }),
        )

        const result = readPersistedReviewsFilters()

        expect(result).toEqual({
            repository: "all",
            search: "",
            status: "all",
            team: "all",
        })
    })
})

describe("validateReviewsSearch", (): void => {
    it("when all params provided, then returns them", (): void => {
        const result = validateReviewsSearch({
            q: "security",
            status: "approved",
            team: "platform",
            repo: "org/repo",
        })

        expect(result).toEqual({
            q: "security",
            status: "approved",
            team: "platform",
            repo: "org/repo",
        })
    })

    it("when no params provided, then returns all undefined", (): void => {
        const result = validateReviewsSearch({})

        expect(result).toEqual({
            q: undefined,
            status: undefined,
            team: undefined,
            repo: undefined,
        })
    })

    it("when q is whitespace only, then returns undefined", (): void => {
        const result = validateReviewsSearch({ q: "   " })

        expect(result.q).toBeUndefined()
    })

    it("when values are non-string, then returns undefined", (): void => {
        const result = validateReviewsSearch({
            q: 42,
            status: true,
            team: null,
            repo: [],
        })

        expect(result).toEqual({
            q: undefined,
            status: undefined,
            team: undefined,
            repo: undefined,
        })
    })
})

describe("sanitizeForRouter edge cases", (): void => {
    it("when search has value, then preserves q", (): void => {
        const result = sanitizeForRouter({
            repository: "all",
            search: "test query",
            status: "all",
            team: "all",
        })

        expect(result.q).toBe("test query")
    })

    it("when all filters have values, then preserves all", (): void => {
        const result = sanitizeForRouter({
            repository: "org/repo",
            search: "test",
            status: "open",
            team: "dev",
        })

        expect(result).toEqual({
            q: "test",
            repo: "org/repo",
            status: "open",
            team: "dev",
        })
    })
})
