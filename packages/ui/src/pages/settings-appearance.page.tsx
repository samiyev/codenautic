import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button, Card, CardBody, CardHeader, Chip, Input } from "@/components/ui"
import { type ThemePresetId, useThemeMode } from "@/lib/theme/theme-provider"
import { showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

type TBasePaletteId = "cool" | "neutral" | "warm"

interface IBasePalette {
    /** Цвет фона приложения. */
    readonly background: string
    /** Цвет границы интерфейсных блоков. */
    readonly border: string
    /** Основной цвет текста. */
    readonly foreground: string
    /** Базовый цвет поверхностей. */
    readonly surface: string
    /** Приглушенный цвет поверхностей. */
    readonly surfaceMuted: string
}

interface IBasePaletteConfig {
    /** Описание palette. */
    readonly description: string
    /** Цвета для dark режима. */
    readonly dark: IBasePalette
    /** Идентификатор палитры. */
    readonly id: TBasePaletteId
    /** Подпись палитры. */
    readonly label: string
    /** Цвета для light режима. */
    readonly light: IBasePalette
}

const BASE_PALETTES: ReadonlyArray<IBasePaletteConfig> = [
    {
        dark: {
            background: "#101520",
            border: "#364257",
            foreground: "#eaf0ff",
            surface: "#1a2233",
            surfaceMuted: "#232d42",
        },
        description: "Balanced slate tones for neutral focus",
        id: "neutral",
        label: "Neutral",
        light: {
            background: "#f4f6fa",
            border: "#d5deea",
            foreground: "#1e2533",
            surface: "#ffffff",
            surfaceMuted: "#edf2f8",
        },
    },
    {
        dark: {
            background: "#18140f",
            border: "#4f3d2a",
            foreground: "#f6ecdf",
            surface: "#231c14",
            surfaceMuted: "#32281d",
        },
        description: "Warm paper-like palette for softer visual comfort",
        id: "warm",
        label: "Warm",
        light: {
            background: "#faf4ec",
            border: "#e5d5c0",
            foreground: "#2e251b",
            surface: "#fffaf3",
            surfaceMuted: "#f3e7d8",
        },
    },
    {
        dark: {
            background: "#0f1723",
            border: "#304a64",
            foreground: "#dff2ff",
            surface: "#162334",
            surfaceMuted: "#203246",
        },
        description: "Cool contrast palette with crisp blues",
        id: "cool",
        label: "Cool",
        light: {
            background: "#edf6ff",
            border: "#c8dcf0",
            foreground: "#1a2a3d",
            surface: "#f7fbff",
            surfaceMuted: "#e4eff8",
        },
    },
]

const APPEARANCE_STORAGE_PREFIX = "codenautic:ui:appearance"
const APPEARANCE_ACCENT_STORAGE_KEY = `${APPEARANCE_STORAGE_PREFIX}:accent`
const APPEARANCE_INTENSITY_STORAGE_KEY = `${APPEARANCE_STORAGE_PREFIX}:intensity`
const APPEARANCE_BASE_PALETTE_STORAGE_KEY = `${APPEARANCE_STORAGE_PREFIX}:base-palette`
const APPEARANCE_RADIUS_STORAGE_KEY = `${APPEARANCE_STORAGE_PREFIX}:radius-global`
const APPEARANCE_FORM_RADIUS_STORAGE_KEY = `${APPEARANCE_STORAGE_PREFIX}:radius-form`

const DEFAULT_ACCENT_COLOR = "#5f6dff"
const DEFAULT_ACCENT_INTENSITY = 76
const DEFAULT_BASE_PALETTE: TBasePaletteId = "neutral"
const DEFAULT_GLOBAL_RADIUS = 14
const DEFAULT_FORM_RADIUS = 12
const MIN_INTENSITY = 40
const MAX_INTENSITY = 100
const MIN_RADIUS = 6
const MAX_RADIUS = 24
const MIN_FORM_RADIUS = 4
const MAX_FORM_RADIUS = 20
const QUICK_PRESET_KEYWORDS: ReadonlyArray<string> = ["default", "sky", "lavender", "mint"]

function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value)
}

function readStoredHexColor(storageKey: string, fallback: string): string {
    if (typeof window === "undefined") {
        return fallback
    }

    const rawValue = window.localStorage.getItem(storageKey)
    if (rawValue === null) {
        return fallback
    }

    return isHexColor(rawValue) ? rawValue.toLowerCase() : fallback
}

function readStoredNumber(
    storageKey: string,
    fallback: number,
    min: number,
    max: number,
): number {
    if (typeof window === "undefined") {
        return fallback
    }

    const rawValue = window.localStorage.getItem(storageKey)
    if (rawValue === null) {
        return fallback
    }

    const parsed = Number(rawValue)
    if (Number.isNaN(parsed) || parsed < min || parsed > max) {
        return fallback
    }

    return parsed
}

function readStoredBasePalette(storageKey: string, fallback: TBasePaletteId): TBasePaletteId {
    if (typeof window === "undefined") {
        return fallback
    }

    const rawValue = window.localStorage.getItem(storageKey)
    if (rawValue === "neutral" || rawValue === "warm" || rawValue === "cool") {
        return rawValue
    }

    return fallback
}

function getPaletteDefinition(basePaletteId: TBasePaletteId): IBasePaletteConfig {
    const matchingPalette = BASE_PALETTES.find((palette): boolean => palette.id === basePaletteId)
    return matchingPalette ?? BASE_PALETTES[0]
}

function getRgbComponents(hex: string): { readonly b: number; readonly g: number; readonly r: number } {
    const normalized = hex.replace("#", "")
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)

    return { b, g, r }
}

function toHexColor(value: number): string {
    return value.toString(16).padStart(2, "0")
}

function mixHexColors(baseHex: string, targetHex: string, ratio: number): string {
    const sanitizedRatio = Math.min(Math.max(ratio, 0), 1)
    const base = getRgbComponents(baseHex)
    const target = getRgbComponents(targetHex)

    const mixedR = Math.round(base.r + (target.r - base.r) * sanitizedRatio)
    const mixedG = Math.round(base.g + (target.g - base.g) * sanitizedRatio)
    const mixedB = Math.round(base.b + (target.b - base.b) * sanitizedRatio)

    return `#${toHexColor(mixedR)}${toHexColor(mixedG)}${toHexColor(mixedB)}`
}

function createEffectiveAccentColor(
    accentColor: string,
    accentIntensity: number,
    resolvedMode: "dark" | "light",
): string {
    const target = resolvedMode === "dark" ? "#e7efff" : "#101727"
    const ratio = ((100 - accentIntensity) / 100) * 0.55

    return mixHexColors(accentColor, target, ratio)
}

function toLinearChannel(channel: number): number {
    const normalizedChannel = channel / 255
    if (normalizedChannel <= 0.03928) {
        return normalizedChannel / 12.92
    }
    return ((normalizedChannel + 0.055) / 1.055) ** 2.4
}

function getRelativeLuminance(color: string): number {
    const { r, g, b } = getRgbComponents(color)
    const linearRed = toLinearChannel(r)
    const linearGreen = toLinearChannel(g)
    const linearBlue = toLinearChannel(b)

    return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
}

function getContrastRatio(firstColor: string, secondColor: string): number {
    const luminanceA = getRelativeLuminance(firstColor)
    const luminanceB = getRelativeLuminance(secondColor)
    const lightest = Math.max(luminanceA, luminanceB)
    const darkest = Math.min(luminanceA, luminanceB)

    return (lightest + 0.05) / (darkest + 0.05)
}

function clearAppearanceStorage(): void {
    if (typeof window === "undefined") {
        return
    }

    window.localStorage.removeItem(APPEARANCE_ACCENT_STORAGE_KEY)
    window.localStorage.removeItem(APPEARANCE_INTENSITY_STORAGE_KEY)
    window.localStorage.removeItem(APPEARANCE_BASE_PALETTE_STORAGE_KEY)
    window.localStorage.removeItem(APPEARANCE_RADIUS_STORAGE_KEY)
    window.localStorage.removeItem(APPEARANCE_FORM_RADIUS_STORAGE_KEY)
}

/**
 * Страница управления темой интерфейса.
 *
 * @returns Экран Appearance с mode/preset переключением и live preview.
 */
export function SettingsAppearancePage(): ReactElement {
    const { mode, preset, presets, resolvedMode, setMode, setPreset } = useThemeMode()
    const [accentColor, setAccentColor] = useState<string>(() =>
        readStoredHexColor(APPEARANCE_ACCENT_STORAGE_KEY, DEFAULT_ACCENT_COLOR),
    )
    const [accentIntensity, setAccentIntensity] = useState<number>(() =>
        readStoredNumber(
            APPEARANCE_INTENSITY_STORAGE_KEY,
            DEFAULT_ACCENT_INTENSITY,
            MIN_INTENSITY,
            MAX_INTENSITY,
        ),
    )
    const [basePaletteId, setBasePaletteId] = useState<TBasePaletteId>(() =>
        readStoredBasePalette(APPEARANCE_BASE_PALETTE_STORAGE_KEY, DEFAULT_BASE_PALETTE),
    )
    const [globalRadius, setGlobalRadius] = useState<number>(() =>
        readStoredNumber(
            APPEARANCE_RADIUS_STORAGE_KEY,
            DEFAULT_GLOBAL_RADIUS,
            MIN_RADIUS,
            MAX_RADIUS,
        ),
    )
    const [formRadius, setFormRadius] = useState<number>(() =>
        readStoredNumber(
            APPEARANCE_FORM_RADIUS_STORAGE_KEY,
            DEFAULT_FORM_RADIUS,
            MIN_FORM_RADIUS,
            MAX_FORM_RADIUS,
        ),
    )
    const [previewFieldValue, setPreviewFieldValue] = useState("security policy update")
    const [pendingRandomPresetId, setPendingRandomPresetId] = useState<ThemePresetId | undefined>(undefined)
    const [lastRandomUndoPresetId, setLastRandomUndoPresetId] = useState<ThemePresetId | undefined>(undefined)
    const [lastAppliedRandomPresetId, setLastAppliedRandomPresetId] = useState<ThemePresetId | undefined>(
        undefined,
    )

    const activeBasePalette = useMemo((): IBasePalette => {
        const definition = getPaletteDefinition(basePaletteId)
        return resolvedMode === "dark" ? definition.dark : definition.light
    }, [basePaletteId, resolvedMode])

    const effectiveAccentColor = useMemo(
        (): string => createEffectiveAccentColor(accentColor, accentIntensity, resolvedMode),
        [accentColor, accentIntensity, resolvedMode],
    )

    const contrastRatio = useMemo(
        (): number => getContrastRatio(effectiveAccentColor, activeBasePalette.surface),
        [effectiveAccentColor, activeBasePalette.surface],
    )

    const isAccessibleContrast = contrastRatio >= 4.5

    const accessiblePresetIds = useMemo((): ReadonlyArray<ThemePresetId> => {
        return presets
            .filter((themePreset): boolean => {
                const palette = resolvedMode === "dark" ? themePreset.dark : themePreset.light
                const primaryContrast = getContrastRatio(palette.primary, palette.surface)
                const accentContrast = getContrastRatio(palette.accent, palette.surface)

                return primaryContrast >= 3 && accentContrast >= 2.6
            })
            .map((themePreset): ThemePresetId => themePreset.id as ThemePresetId)
    }, [presets, resolvedMode])

    const quickPresetOptions = useMemo((): ReadonlyArray<typeof presets[number]> => {
        const selected: Array<typeof presets[number]> = []
        const selectedIds = new Set<string>()

        QUICK_PRESET_KEYWORDS.forEach((keyword): void => {
            const match = presets.find(
                (themePreset): boolean =>
                    themePreset.label.toLowerCase().includes(keyword)
                    || themePreset.id.toLowerCase().includes(keyword),
            )
            if (match !== undefined && selectedIds.has(match.id) === false) {
                selected.push(match)
                selectedIds.add(match.id)
            }
        })

        presets.forEach((themePreset): void => {
            if (selected.length >= 4) {
                return
            }
            if (selectedIds.has(themePreset.id)) {
                return
            }
            selected.push(themePreset)
            selectedIds.add(themePreset.id)
        })

        return selected
    }, [presets])

    const pendingRandomPreset = useMemo(() => {
        if (pendingRandomPresetId === undefined) {
            return undefined
        }
        return presets.find((themePreset): boolean => themePreset.id === pendingRandomPresetId)
    }, [pendingRandomPresetId, presets])

    const lastAppliedRandomPreset = useMemo(() => {
        if (lastAppliedRandomPresetId === undefined) {
            return undefined
        }
        return presets.find((themePreset): boolean => themePreset.id === lastAppliedRandomPresetId)
    }, [lastAppliedRandomPresetId, presets])

    const selectRandomPresetPreview = useCallback((): void => {
        const currentPresetId = preset as ThemePresetId
        const candidateIds = accessiblePresetIds.filter(
            (presetId): boolean =>
                presetId !== currentPresetId && presetId !== pendingRandomPresetId,
        )
        if (candidateIds.length === 0) {
            showToastInfo("No alternative accessible presets available for random preview.")
            return
        }

        const randomIndex = Math.floor(Math.random() * candidateIds.length)
        const randomPresetId = candidateIds[randomIndex]
        if (randomPresetId === undefined) {
            return
        }
        setPendingRandomPresetId(randomPresetId)
        showToastInfo("Random preset preview generated.")
    }, [accessiblePresetIds, pendingRandomPresetId, preset])

    const handleApplyRandomPreset = (): void => {
        if (pendingRandomPresetId === undefined) {
            return
        }

        const currentPresetId = preset as ThemePresetId
        setLastRandomUndoPresetId(currentPresetId)
        setLastAppliedRandomPresetId(pendingRandomPresetId)
        setPreset(pendingRandomPresetId)
        setPendingRandomPresetId(undefined)
        showToastSuccess("Random preset applied.")
    }

    const handleUndoRandomPreset = (): void => {
        if (lastRandomUndoPresetId === undefined) {
            return
        }

        setPreset(lastRandomUndoPresetId)
        setLastRandomUndoPresetId(undefined)
        showToastSuccess("Last random preset reverted.")
    }

    useEffect((): void => {
        if (typeof window === "undefined") {
            return
        }

        const root = document.documentElement
        const smRadius = Math.max(4, Math.round(globalRadius * 0.56))
        const mdRadius = Math.max(6, globalRadius)
        const lgRadius = Math.max(8, globalRadius + 4)

        root.style.setProperty("--accent", effectiveAccentColor)
        root.style.setProperty("--background", activeBasePalette.background)
        root.style.setProperty("--foreground", activeBasePalette.foreground)
        root.style.setProperty("--surface", activeBasePalette.surface)
        root.style.setProperty("--surface-muted", activeBasePalette.surfaceMuted)
        root.style.setProperty("--border", activeBasePalette.border)
        root.style.setProperty("--radius-sm", `${smRadius}px`)
        root.style.setProperty("--radius-md", `${mdRadius}px`)
        root.style.setProperty("--radius-lg", `${lgRadius}px`)
        root.style.setProperty("--radius-form", `${formRadius}px`)

        window.localStorage.setItem(APPEARANCE_ACCENT_STORAGE_KEY, accentColor)
        window.localStorage.setItem(
            APPEARANCE_INTENSITY_STORAGE_KEY,
            String(accentIntensity),
        )
        window.localStorage.setItem(
            APPEARANCE_BASE_PALETTE_STORAGE_KEY,
            basePaletteId,
        )
        window.localStorage.setItem(APPEARANCE_RADIUS_STORAGE_KEY, String(globalRadius))
        window.localStorage.setItem(
            APPEARANCE_FORM_RADIUS_STORAGE_KEY,
            String(formRadius),
        )
    }, [
        accentColor,
        accentIntensity,
        activeBasePalette.background,
        activeBasePalette.border,
        activeBasePalette.foreground,
        activeBasePalette.surface,
        activeBasePalette.surfaceMuted,
        basePaletteId,
        effectiveAccentColor,
        formRadius,
        globalRadius,
        mode,
        preset,
    ])

    useEffect((): (() => void) | void => {
        if (typeof window === "undefined") {
            return undefined
        }

        const onKeyDown = (event: KeyboardEvent): void => {
            const isRandomHotkey = event.altKey && event.key.toLowerCase() === "r"
            if (isRandomHotkey !== true) {
                return
            }
            event.preventDefault()
            selectRandomPresetPreview()
        }

        window.addEventListener("keydown", onKeyDown)
        return (): void => {
            window.removeEventListener("keydown", onKeyDown)
        }
    }, [selectRandomPresetPreview])

    const handleResetTheme = (): void => {
        const defaultPreset = presets.at(0)?.id
        setMode("system")
        if (defaultPreset !== undefined) {
            setPreset(defaultPreset as ThemePresetId)
        }
        setAccentColor(DEFAULT_ACCENT_COLOR)
        setAccentIntensity(DEFAULT_ACCENT_INTENSITY)
        setBasePaletteId(DEFAULT_BASE_PALETTE)
        setGlobalRadius(DEFAULT_GLOBAL_RADIUS)
        setFormRadius(DEFAULT_FORM_RADIUS)
        setPendingRandomPresetId(undefined)
        setLastRandomUndoPresetId(undefined)
        setLastAppliedRandomPresetId(undefined)
        clearAppearanceStorage()
        showToastSuccess("Theme reset to defaults.")
    }

    return (
        <section className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Appearance settings</h1>
            <p className="text-sm text-[var(--foreground)]/70">
                Switch theme mode and presets in one place. All changes are applied immediately
                without page reload.
            </p>

            <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-semibold text-[var(--foreground)]">
                        Theme controls
                    </p>
                    <Button
                        variant="flat"
                        onPress={handleResetTheme}
                    >
                        Reset to default
                    </Button>
                </CardHeader>
                <CardBody className="space-y-3">
                    <ThemeToggle />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground)]/70">
                        <Chip size="sm" variant="flat">
                            mode: {mode}
                        </Chip>
                        <Chip size="sm" variant="flat">
                            preset: {preset}
                        </Chip>
                        <Chip size="sm" variant="flat">
                            resolved: {resolvedMode}
                        </Chip>
                        {lastAppliedRandomPreset !== undefined ? (
                            <Chip size="sm" variant="flat">
                                last random: {lastAppliedRandomPreset.label}
                            </Chip>
                        ) : null}
                    </div>
                    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/60">
                            Quick presets
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {quickPresetOptions.map((themePreset): ReactElement => (
                                <Button
                                    key={themePreset.id}
                                    aria-label={`Quick preset ${themePreset.label}`}
                                    radius="full"
                                    size="sm"
                                    variant={themePreset.id === preset ? "solid" : "flat"}
                                    onPress={(): void => {
                                        setPreset(themePreset.id as ThemePresetId)
                                    }}
                                >
                                    {themePreset.label}
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                aria-keyshortcuts="Alt+R"
                                radius="full"
                                size="sm"
                                variant="flat"
                                onPress={selectRandomPresetPreview}
                            >
                                Random preset (Alt+R)
                            </Button>
                            {lastRandomUndoPresetId !== undefined ? (
                                <Button
                                    radius="full"
                                    size="sm"
                                    variant="flat"
                                    onPress={handleUndoRandomPreset}
                                >
                                    Undo last random
                                </Button>
                            ) : null}
                        </div>
                        {pendingRandomPreset !== undefined ? (
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                    Preview preset: {pendingRandomPreset.label}
                                </p>
                                <p className="mt-1 text-xs text-[var(--foreground)]/70">
                                    Apply to switch immediately or cancel to keep current theme.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        onPress={handleApplyRandomPreset}
                                    >
                                        Apply random preset
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        onPress={(): void => {
                                            setPendingRandomPresetId(undefined)
                                        }}
                                    >
                                        Cancel random preview
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-base font-semibold text-[var(--foreground)]">
                        Advanced controls
                    </p>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                                Accent control
                            </p>
                            <div className="flex items-center gap-3">
                                <input
                                    aria-label="Accent color picker"
                                    className="h-10 w-14 cursor-pointer rounded-md border border-[var(--border)] bg-transparent p-1"
                                    type="color"
                                    value={accentColor}
                                    onChange={(event): void => {
                                        setAccentColor(event.currentTarget.value)
                                    }}
                                />
                                <p className="text-xs font-mono text-[var(--foreground)]/70">
                                    {effectiveAccentColor}
                                </p>
                            </div>
                            <label
                                className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/60"
                                htmlFor="accent-intensity-slider"
                            >
                                Accent intensity: {accentIntensity}
                            </label>
                            <input
                                aria-label="Accent intensity slider"
                                className="w-full accent-[var(--primary)]"
                                id="accent-intensity-slider"
                                max={MAX_INTENSITY}
                                min={MIN_INTENSITY}
                                type="range"
                                value={accentIntensity}
                                onChange={(event): void => {
                                    setAccentIntensity(Number(event.currentTarget.value))
                                }}
                            />
                        </div>

                        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                                Base palette
                            </p>
                            <div
                                aria-label="Base palette picker"
                                className="flex flex-wrap gap-2"
                                role="group"
                            >
                                {BASE_PALETTES.map((palette): ReactElement => (
                                    <Button
                                        key={palette.id}
                                        aria-pressed={basePaletteId === palette.id}
                                        radius="full"
                                        size="sm"
                                        variant={basePaletteId === palette.id ? "solid" : "flat"}
                                        onPress={(): void => {
                                            setBasePaletteId(palette.id)
                                        }}
                                    >
                                        {palette.label}
                                    </Button>
                                ))}
                            </div>
                            <p className="text-xs text-[var(--foreground)]/70">
                                {getPaletteDefinition(basePaletteId).description}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <label
                                className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/60"
                                htmlFor="global-radius-slider"
                            >
                                Global radius: {globalRadius}px
                            </label>
                            <input
                                aria-label="Global radius slider"
                                className="w-full accent-[var(--primary)]"
                                id="global-radius-slider"
                                max={MAX_RADIUS}
                                min={MIN_RADIUS}
                                type="range"
                                value={globalRadius}
                                onChange={(event): void => {
                                    setGlobalRadius(Number(event.currentTarget.value))
                                }}
                            />
                        </div>
                        <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <label
                                className="text-xs uppercase tracking-[0.12em] text-[var(--foreground)]/60"
                                htmlFor="form-radius-slider"
                            >
                                Form radius: {formRadius}px
                            </label>
                            <input
                                aria-label="Form radius slider"
                                className="w-full accent-[var(--primary)]"
                                id="form-radius-slider"
                                max={MAX_FORM_RADIUS}
                                min={MIN_FORM_RADIUS}
                                type="range"
                                value={formRadius}
                                onChange={(event): void => {
                                    setFormRadius(Number(event.currentTarget.value))
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--foreground)]/70">
                        <Chip size="sm" variant="flat">
                            base: {basePaletteId}
                        </Chip>
                        <Chip size="sm" variant="flat">
                            global radius: {globalRadius}px
                        </Chip>
                        <Chip size="sm" variant="flat">
                            form radius: {formRadius}px
                        </Chip>
                        <Chip
                            color={isAccessibleContrast ? "success" : "warning"}
                            size="sm"
                            variant="flat"
                        >
                            contrast: {contrastRatio.toFixed(2)} ({isAccessibleContrast ? "AA" : "check"})
                        </Chip>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-base font-semibold text-[var(--foreground)]">Live preview</p>
                </CardHeader>
                <CardBody className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground)]/60">
                                Primary action
                            </p>
                            <button
                                className="mt-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
                                style={{ borderRadius: `${globalRadius}px` }}
                                type="button"
                            >
                                Preview button
                            </button>
                            <button
                                className="ml-2 mt-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent-foreground)]"
                                style={{ borderRadius: `${globalRadius}px` }}
                                type="button"
                            >
                                Accent action
                            </button>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground)]/60">
                                Accent & surface
                            </p>
                            <div className="mt-2 flex gap-2">
                                <span className="h-6 w-6 rounded-full bg-[var(--accent)]" />
                                <span className="h-6 w-6 rounded-full bg-[var(--surface-muted)]" />
                            </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-[var(--foreground)]/60">
                                Form controls
                            </p>
                            <Input
                                aria-label="Appearance preview input"
                                className="mt-2"
                                placeholder="Preview input"
                                style={{ borderRadius: `${formRadius}px` }}
                                value={previewFieldValue}
                                onValueChange={setPreviewFieldValue}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-[var(--foreground)]/70">
                        Preset options: {presets.map((themePreset): string => themePreset.label).join(", ")}
                    </p>
                </CardBody>
            </Card>
        </section>
    )
}
