import { describe, expect, it, vi } from "vitest"

import { mapRepositoryUrlToRouteId, resolveOnboardingScanSearch } from "@/routes/onboarding"

describe("onboarding route helpers", (): void => {
    it("маппит repository URL в route id для https и ssh форматов", (): void => {
        expect(mapRepositoryUrlToRouteId("https://github.com/example/repository")).toBe(
            "example/repository",
        )
        expect(mapRepositoryUrlToRouteId("https://github.com/example/repository.git")).toBe(
            "example/repository",
        )
        expect(mapRepositoryUrlToRouteId("git@github.com:example/repository.git")).toBe(
            "example/repository",
        )
        expect(
            mapRepositoryUrlToRouteId("https://gitlab.example.com/group/subgroup/repository"),
        ).toBe("subgroup/repository")
    })

    it("возвращает fallback repository id для пустых/некорректных значений", (): void => {
        expect(mapRepositoryUrlToRouteId("")).toBe("platform-team/api-gateway")
        expect(mapRepositoryUrlToRouteId("   ")).toBe("platform-team/api-gateway")
        expect(mapRepositoryUrlToRouteId("invalid-url")).toBe("platform-team/api-gateway")
    })

    it("формирует scan search для single onboarding", (): void => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-03-06T12:00:00.000Z"))

        try {
            const search = resolveOnboardingScanSearch({
                targetRepositories: ["https://github.com/example/repository"],
            })

            expect(search).toEqual({
                jobId: "scan-1772798400000",
                repositoryId: "example/repository",
                source: "onboarding",
            })
        } finally {
            vi.useRealTimers()
        }
    })

    it("сохраняет весь список репозиториев для bulk onboarding", (): void => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-03-06T12:00:00.000Z"))

        try {
            const search = resolveOnboardingScanSearch({
                targetRepositories: [
                    "https://github.com/example/first",
                    "https://github.com/example/second",
                ],
            })

            expect(search).toEqual({
                jobId: "scan-1772798400000",
                source: "onboarding",
                targetRepositories: [
                    "https://github.com/example/first",
                    "https://github.com/example/second",
                ],
            })
        } finally {
            vi.useRealTimers()
        }
    })
})
