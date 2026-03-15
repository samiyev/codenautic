import { useCallback, useEffect, useState } from "react"
import { useTheme as useNextTheme } from "next-themes"

/**
 * Режим темы интерфейса.
 */
export type TThemeMode = "dark" | "light" | "system"

/**
 * Идентификатор цветового пресета.
 */
export type TThemePreset = "aqua" | "cobalt" | "forest" | "graphite" | "moonstone" | "sunrise"

/**
 * Каталог доступных пресетов.
 */
const PRESETS: ReadonlyArray<{ readonly id: TThemePreset; readonly label: string }> = [
    { id: "moonstone", label: "Moonstone" },
    { id: "cobalt", label: "Cobalt" },
    { id: "forest", label: "Forest" },
    { id: "sunrise", label: "Sunrise" },
    { id: "graphite", label: "Graphite" },
    { id: "aqua", label: "Aqua" },
]

/**
 * Ключ localStorage для пресета.
 */
const PRESET_STORAGE_KEY = "cn:theme-preset"

/**
 * Пресет по умолчанию.
 */
const DEFAULT_PRESET: TThemePreset = "sunrise"

/**
 * Проверяет, является ли значение валидным пресетом.
 *
 * @param value Значение для проверки.
 * @returns true если значение является TThemePreset.
 */
function isValidPreset(value: string | null): value is TThemePreset {
    if (value === null) {
        return false
    }
    return PRESETS.some((p): boolean => p.id === value)
}

/**
 * Читает пресет из localStorage.
 *
 * @returns Сохранённый пресет или значение по умолчанию.
 */
function readStoredPreset(): TThemePreset {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY)
    if (isValidPreset(stored)) {
        return stored
    }
    return DEFAULT_PRESET
}

/**
 * Hook для управления темой приложения.
 * Использует next-themes для mode (light/dark/system) и localStorage для preset.
 *
 * @returns Состояние темы и функции управления.
 */
export function useTheme(): {
    mode: TThemeMode
    preset: TThemePreset
    presets: typeof PRESETS
    resolvedMode: "dark" | "light"
    setMode: (m: TThemeMode) => void
    setPreset: (p: TThemePreset) => void
} {
    const { theme, setTheme, resolvedTheme } = useNextTheme()
    const [preset, setPresetState] = useState<TThemePreset>(readStoredPreset)

    const mode: TThemeMode = (theme as TThemeMode | undefined) ?? "system"
    const resolvedMode: "dark" | "light" = resolvedTheme === "dark" ? "dark" : "light"

    const stableSetMode = useCallback(
        (m: TThemeMode): void => {
            setTheme(m)
        },
        [setTheme],
    )

    const stableSetPreset = useCallback((p: TThemePreset): void => {
        setPresetState(p)
        localStorage.setItem(PRESET_STORAGE_KEY, p)
        document.documentElement.setAttribute("data-theme", p)
    }, [])

    useEffect((): void => {
        document.documentElement.setAttribute("data-theme", preset)
    }, [preset])

    return {
        mode,
        preset,
        presets: PRESETS,
        resolvedMode,
        setMode: stableSetMode,
        setPreset: stableSetPreset,
    }
}
