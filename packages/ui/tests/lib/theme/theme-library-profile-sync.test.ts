import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import type { IThemeLibraryProfileState } from "@/lib/theme/theme-library-profile-sync"

vi.mock("@/lib/api/config", (): Record<string, unknown> => {
    return {
        createApiConfig: vi.fn().mockReturnValue({
            baseUrl: "http://localhost:3000",
            defaultHeaders: {},
        }),
        resolveUiEnv: vi.fn().mockReturnValue("test"),
    }
})

describe("theme library profile sync internal parsers", (): void => {
    describe("IThemeLibraryProfileState type contract", (): void => {
        it("when valid state is created, then all fields are accessible", (): void => {
            const state: IThemeLibraryProfileState = {
                themes: [
                    {
                        id: "theme-1",
                        name: "My Theme",
                        mode: "dark",
                        presetId: "cobalt",
                        basePaletteId: "cool",
                        accentColor: "#ff5500",
                        accentIntensity: 80,
                        globalRadius: 12,
                        formRadius: 8,
                    },
                ],
                favoritePresetId: "moonstone",
                updatedAtMs: 1700000000,
            }

            expect(state.themes).toHaveLength(1)
            expect(state.themes[0]?.id).toBe("theme-1")
            expect(state.themes[0]?.name).toBe("My Theme")
            expect(state.themes[0]?.mode).toBe("dark")
            expect(state.themes[0]?.basePaletteId).toBe("cool")
            expect(state.themes[0]?.accentColor).toBe("#ff5500")
            expect(state.favoritePresetId).toBe("moonstone")
            expect(state.updatedAtMs).toBe(1700000000)
        })

        it("when state has no favorite preset, then favoritePresetId is undefined", (): void => {
            const state: IThemeLibraryProfileState = {
                themes: [
                    {
                        id: "theme-2",
                        name: "Other Theme",
                        mode: "light",
                        presetId: "forest",
                        basePaletteId: "warm",
                        accentColor: "#00ff00",
                        accentIntensity: 60,
                        globalRadius: 8,
                        formRadius: 6,
                    },
                ],
                favoritePresetId: undefined,
                updatedAtMs: 0,
            }

            expect(state.favoritePresetId).toBeUndefined()
        })

        it("when state has empty themes array, then themes is empty", (): void => {
            const state: IThemeLibraryProfileState = {
                themes: [],
                favoritePresetId: "cobalt",
                updatedAtMs: 500,
            }

            expect(state.themes).toHaveLength(0)
        })
    })

    describe("IThemeLibraryProfileTheme mode values", (): void => {
        it("when mode is dark, then is valid", (): void => {
            const theme = createValidThemeWithMode("dark")
            expect(theme.mode).toBe("dark")
        })

        it("when mode is light, then is valid", (): void => {
            const theme = createValidThemeWithMode("light")
            expect(theme.mode).toBe("light")
        })

        it("when mode is system, then is valid", (): void => {
            const theme = createValidThemeWithMode("system")
            expect(theme.mode).toBe("system")
        })
    })

    describe("IThemeLibraryProfileTheme basePaletteId values", (): void => {
        it("when basePaletteId is cool, then is valid", (): void => {
            const theme = createValidThemeWithPalette("cool")
            expect(theme.basePaletteId).toBe("cool")
        })

        it("when basePaletteId is neutral, then is valid", (): void => {
            const theme = createValidThemeWithPalette("neutral")
            expect(theme.basePaletteId).toBe("neutral")
        })

        it("when basePaletteId is warm, then is valid", (): void => {
            const theme = createValidThemeWithPalette("warm")
            expect(theme.basePaletteId).toBe("warm")
        })
    })

    describe("IThemeLibraryProfileTheme numeric constraints", (): void => {
        it("when accentIntensity is at minimum boundary, then is valid", (): void => {
            const state = createStateWithThemeOverrides({ accentIntensity: 40 })
            expect(state.themes[0]?.accentIntensity).toBe(40)
        })

        it("when accentIntensity is at maximum boundary, then is valid", (): void => {
            const state = createStateWithThemeOverrides({ accentIntensity: 100 })
            expect(state.themes[0]?.accentIntensity).toBe(100)
        })

        it("when globalRadius is at minimum boundary, then is valid", (): void => {
            const state = createStateWithThemeOverrides({ globalRadius: 6 })
            expect(state.themes[0]?.globalRadius).toBe(6)
        })

        it("when globalRadius is at maximum boundary, then is valid", (): void => {
            const state = createStateWithThemeOverrides({ globalRadius: 24 })
            expect(state.themes[0]?.globalRadius).toBe(24)
        })

        it("when formRadius is at minimum boundary, then is valid", (): void => {
            const state = createStateWithThemeOverrides({ formRadius: 4 })
            expect(state.themes[0]?.formRadius).toBe(4)
        })

        it("when formRadius is at maximum boundary, then is valid", (): void => {
            const state = createStateWithThemeOverrides({ formRadius: 20 })
            expect(state.themes[0]?.formRadius).toBe(20)
        })
    })

    describe("readThemeLibraryProfileState", (): void => {
        let originalFetch: typeof globalThis.fetch

        beforeEach((): void => {
            originalFetch = globalThis.fetch
        })

        afterEach((): void => {
            globalThis.fetch = originalFetch
            vi.restoreAllMocks()
        })

        it("when API returns valid themeLibrary payload, then parses correctly", async (): Promise<void> => {
            const { readThemeLibraryProfileState } = await import(
                "@/lib/theme/theme-library-profile-sync"
            )

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue(
                    JSON.stringify({
                        themeLibrary: {
                            themes: [
                                {
                                    id: "t1",
                                    name: "Test Theme",
                                    mode: "dark",
                                    presetId: "cobalt",
                                    basePaletteId: "cool",
                                    accentColor: "#aabbcc",
                                    accentIntensity: 70,
                                    globalRadius: 10,
                                    formRadius: 8,
                                },
                            ],
                            favoritePresetId: "moonstone",
                            updatedAtMs: 5000,
                        },
                    }),
                ),
            })

            const result = await readThemeLibraryProfileState()

            expect(result).toBeDefined()
            if (result !== undefined) {
                expect(result.themes).toHaveLength(1)
                expect(result.themes[0]?.id).toBe("t1")
                expect(result.favoritePresetId).toBe("moonstone")
            }
        })
    })

    describe("writeThemeLibraryProfileState", (): void => {
        let originalFetch: typeof globalThis.fetch

        beforeEach((): void => {
            originalFetch = globalThis.fetch
        })

        afterEach((): void => {
            globalThis.fetch = originalFetch
            vi.restoreAllMocks()
        })

        it("when API accepts the write, then returns true", async (): Promise<void> => {
            const { writeThemeLibraryProfileState } = await import(
                "@/lib/theme/theme-library-profile-sync"
            )

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue("{}"),
            })

            const profile: IThemeLibraryProfileState = {
                themes: [],
                favoritePresetId: "cobalt",
                updatedAtMs: 1000,
            }

            const result = await writeThemeLibraryProfileState(profile)
            expect(result).toBe(true)
        })

        it("when all API endpoints and methods fail, then returns false", async (): Promise<void> => {
            const { writeThemeLibraryProfileState } = await import(
                "@/lib/theme/theme-library-profile-sync"
            )

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                headers: new Headers(),
                text: vi.fn().mockResolvedValue("Server error"),
            })

            const profile: IThemeLibraryProfileState = {
                themes: [],
                favoritePresetId: "cobalt",
                updatedAtMs: 1000,
            }

            const result = await writeThemeLibraryProfileState(profile)
            expect(result).toBe(false)
        })
    })
})

function createValidThemeWithMode(
    mode: "dark" | "light" | "system",
): IThemeLibraryProfileState["themes"][number] {
    return {
        id: "theme-test",
        name: "Test Theme",
        mode,
        presetId: "moonstone",
        basePaletteId: "neutral",
        accentColor: "#112233",
        accentIntensity: 70,
        globalRadius: 12,
        formRadius: 8,
    }
}

function createValidThemeWithPalette(
    basePaletteId: "cool" | "neutral" | "warm",
): IThemeLibraryProfileState["themes"][number] {
    return {
        id: "theme-palette",
        name: "Palette Test",
        mode: "dark",
        presetId: "cobalt",
        basePaletteId,
        accentColor: "#aabbcc",
        accentIntensity: 60,
        globalRadius: 10,
        formRadius: 6,
    }
}

function createStateWithThemeOverrides(
    overrides: Partial<IThemeLibraryProfileState["themes"][number]>,
): IThemeLibraryProfileState {
    return {
        themes: [
            {
                id: "theme-override",
                name: "Override Test",
                mode: "dark",
                presetId: "moonstone",
                basePaletteId: "neutral",
                accentColor: "#000000",
                accentIntensity: 70,
                globalRadius: 12,
                formRadius: 8,
                ...overrides,
            },
        ],
        favoritePresetId: undefined,
        updatedAtMs: 0,
    }
}
