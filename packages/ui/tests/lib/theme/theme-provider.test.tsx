import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import { type ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { THEME_PRESETS, initializeTheme, useThemeMode } from "@/lib/theme/theme-provider"
import { server } from "../../mocks/server"
import { renderWithProviders } from "../../utils/render"

function ThemeStateProbe(): ReactElement {
    const { mode, preset } = useThemeMode()

    return <p data-testid="theme-state">{`${mode}:${preset}`}</p>
}

describe("ThemeProvider", (): void => {
    it("не падает при initializeTheme, если localStorage недоступен", (): void => {
        const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
        if (localStorageDescriptor === undefined) {
            throw new Error("window.localStorage descriptor is required for this test")
        }

        Object.defineProperty(window, "localStorage", {
            configurable: true,
            get(): Storage {
                throw new DOMException("Access denied", "SecurityError")
            },
        })

        try {
            expect((): void => {
                initializeTheme()
            }).not.toThrow()
        } finally {
            Object.defineProperty(window, "localStorage", localStorageDescriptor)
        }
    })

    it("предпочитает более свежий удалённый профиль темы локальному дефолту", async (): Promise<void> => {
        const remotePreset = THEME_PRESETS.at(1)?.id ?? THEME_PRESETS[0].id

        localStorage.setItem("codenautic:ui:theme-mode", "system")
        localStorage.setItem("codenautic:ui:theme-preset", THEME_PRESETS[0]?.id ?? "moonstone")
        localStorage.removeItem("codenautic:ui:theme-profile-synced")

        server.use(
            http.get("http://localhost:7120/api/v1/user/settings", () => {
                return HttpResponse.json({
                    theme: {
                        mode: "dark",
                        preset: remotePreset,
                    },
                    updatedAt: "2026-03-06T12:00:00Z",
                })
            }),
            http.put("http://localhost:7120/api/v1/user/settings", () => {
                return HttpResponse.json({})
            }),
            http.patch("http://localhost:7120/api/v1/user/settings", () => {
                return HttpResponse.json({})
            }),
            http.post("http://localhost:7120/api/v1/user/settings", () => {
                return HttpResponse.json({})
            }),
        )

        renderWithProviders(<ThemeStateProbe />)

        await waitFor((): void => {
            expect(screen.getByTestId("theme-state")).toHaveTextContent(`dark:${remotePreset}`)
        })
    })

    it("не пытается записать theme profile на первом mount, если backend недоступен", async (): Promise<void> => {
        let getSettingsCalls = 0
        let getPreferencesCalls = 0
        let writeCalls = 0

        localStorage.setItem("codenautic:ui:theme-mode", "system")
        localStorage.setItem("codenautic:ui:theme-preset", THEME_PRESETS[0]?.id ?? "moonstone")
        localStorage.removeItem("codenautic:ui:theme-profile-synced")

        server.use(
            http.get("http://localhost:7120/api/v1/user/settings", () => {
                getSettingsCalls += 1
                return HttpResponse.error()
            }),
            http.get("http://localhost:7120/api/v1/user/preferences", () => {
                getPreferencesCalls += 1
                return HttpResponse.error()
            }),
            http.put("http://localhost:7120/api/v1/user/settings", () => {
                writeCalls += 1
                return HttpResponse.json({})
            }),
            http.patch("http://localhost:7120/api/v1/user/settings", () => {
                writeCalls += 1
                return HttpResponse.json({})
            }),
            http.post("http://localhost:7120/api/v1/user/settings", () => {
                writeCalls += 1
                return HttpResponse.json({})
            }),
            http.put("http://localhost:7120/api/v1/user/preferences", () => {
                writeCalls += 1
                return HttpResponse.json({})
            }),
            http.patch("http://localhost:7120/api/v1/user/preferences", () => {
                writeCalls += 1
                return HttpResponse.json({})
            }),
            http.post("http://localhost:7120/api/v1/user/preferences", () => {
                writeCalls += 1
                return HttpResponse.json({})
            }),
        )

        renderWithProviders(<ThemeStateProbe />)

        await waitFor((): void => {
            expect(getSettingsCalls).toBe(1)
            expect(getPreferencesCalls).toBe(1)
        })
        await waitFor((): void => {
            expect(writeCalls).toBe(0)
        })
        expect(screen.getByTestId("theme-state")).toHaveTextContent(
            `system:${THEME_PRESETS[0]?.id ?? "moonstone"}`,
        )
    })
})
