import { useCallback, useEffect, useSyncExternalStore } from "react"

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
 * Разрешает режим темы с учётом system preference.
 *
 * @param mode Режим темы.
 * @returns Физический режим: "light" или "dark".
 */
function resolveMode(mode: TThemeMode): "dark" | "light" {
    if (mode !== "system") {
        return mode
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * Применяет тему к document.documentElement.
 *
 * @param mode Режим темы.
 * @param preset Идентификатор пресета.
 */
function apply(mode: TThemeMode, preset: TThemePreset): void {
    const resolved = resolveMode(mode)
    document.documentElement.setAttribute("data-theme", preset)
    document.documentElement.classList.toggle("dark", resolved === "dark")
    document.documentElement.style.colorScheme = resolved
}

interface ISnapshot {
    readonly mode: TThemeMode
    readonly preset: TThemePreset
}

const listeners = new Set<() => void>()
let snapshot: ISnapshot = { mode: "system", preset: "sunrise" }

function subscribe(cb: () => void): () => void {
    listeners.add(cb)
    return (): void => {
        listeners.delete(cb)
    }
}

function getSnapshot(): ISnapshot {
    return snapshot
}

function setMode(m: TThemeMode): void {
    localStorage.setItem("cn:theme-mode", m)
    snapshot = { ...snapshot, mode: m }
    apply(snapshot.mode, snapshot.preset)
    listeners.forEach((cb): void => {
        cb()
    })
}

function setPreset(p: TThemePreset): void {
    localStorage.setItem("cn:theme-preset", p)
    snapshot = { ...snapshot, preset: p }
    apply(snapshot.mode, snapshot.preset)
    listeners.forEach((cb): void => {
        cb()
    })
}

/**
 * Инициализирует тему ДО React-рендера для предотвращения flash.
 * Вызывается в main.tsx перед createRoot.
 */
export function initializeTheme(): void {
    const mode = (localStorage.getItem("cn:theme-mode") as TThemeMode | null) ?? "system"
    const preset = (localStorage.getItem("cn:theme-preset") as TThemePreset | null) ?? "sunrise"
    snapshot = { mode, preset }
    apply(mode, preset)
}

/**
 * Hook для управления темой приложения.
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
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const stableSetMode = useCallback((m: TThemeMode): void => {
        setMode(m)
    }, [])

    const stableSetPreset = useCallback((p: TThemePreset): void => {
        setPreset(p)
    }, [])

    useEffect((): (() => void) | undefined => {
        if (state.mode !== "system") {
            return undefined
        }
        const mq = window.matchMedia("(prefers-color-scheme: dark)")
        const handler = (): void => {
            apply(state.mode, state.preset)
            listeners.forEach((cb): void => {
                cb()
            })
        }
        mq.addEventListener("change", handler)
        return (): void => {
            mq.removeEventListener("change", handler)
        }
    }, [state.mode, state.preset])

    return {
        mode: state.mode,
        preset: state.preset,
        presets: PRESETS,
        resolvedMode: resolveMode(state.mode),
        setMode: stableSetMode,
        setPreset: stableSetPreset,
    }
}
