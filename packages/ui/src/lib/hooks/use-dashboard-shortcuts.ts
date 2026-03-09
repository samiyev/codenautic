import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"

import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts"
import {
    FOCUS_REVIEWS_FILTERS_EVENT,
    OPEN_COMMAND_PALETTE_EVENT,
    type IShortcutConflict,
    type IShortcutDefinition,
    type IShortcutDescriptor,
} from "@/lib/keyboard/shortcut-registry"

/**
 * Результат хука управления keyboard shortcuts для dashboard.
 */
export interface IDashboardShortcutsResult {
    /** Открыт ли модал помощи по shortcuts. */
    readonly isShortcutsHelpOpen: boolean
    /** Обработчик открытия/закрытия модала. */
    readonly setIsShortcutsHelpOpen: (value: boolean) => void
    /** Текущий поисковый запрос в модале shortcuts. */
    readonly shortcutsHelpQuery: string
    /** Обработчик изменения поискового запроса. */
    readonly setShortcutsHelpQuery: (value: string) => void
    /** Отфильтрованные shortcuts по поисковому запросу. */
    readonly filteredShortcuts: ReadonlyArray<IShortcutDescriptor>
    /** Конфликты между shortcuts. */
    readonly conflicts: ReadonlyArray<IShortcutConflict>
}

/**
 * Управляет keyboard shortcuts для dashboard: определения, поиск, фильтрация
 * и состояние модала помощи.
 *
 * @returns Состояние shortcuts и обработчики модала.
 */
export function useDashboardShortcuts(): IDashboardShortcutsResult {
    const navigate = useNavigate()
    const location = useLocation()
    const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)
    const [shortcutsHelpQuery, setShortcutsHelpQuery] = useState("")

    const shortcutDefinitions = useMemo((): ReadonlyArray<IShortcutDefinition> => {
        return [
            {
                handler: (): void => {
                    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
                },
                id: "open-command-palette-meta",
                keys: "meta+k",
                label: "Open command palette",
                scope: "global",
            },
            {
                handler: (): void => {
                    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
                },
                id: "open-command-palette-ctrl",
                keys: "ctrl+k",
                label: "Open command palette",
                scope: "global",
            },
            {
                handler: (): void => {
                    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
                },
                id: "open-command-palette-slash",
                keys: "slash",
                label: "Open command palette",
                scope: "global",
            },
            {
                handler: (): void => {
                    void navigate({ to: "/" })
                },
                id: "goto-dashboard",
                keys: "g d",
                label: "Go to dashboard",
                scope: "global",
            },
            {
                handler: (): void => {
                    void navigate({ to: "/reviews" })
                },
                id: "goto-reviews",
                keys: "g r",
                label: "Go to ccr management",
                scope: "global",
            },
            {
                handler: (): void => {
                    window.dispatchEvent(new CustomEvent(FOCUS_REVIEWS_FILTERS_EVENT))
                },
                id: "focus-reviews-filters",
                keys: "f",
                label: "Focus reviews filters",
                routePredicate: (routePath: string): boolean => routePath === "/reviews",
                scope: "page",
            },
            {
                handler: (): void => {
                    setIsShortcutsHelpOpen(true)
                },
                id: "open-shortcuts-help",
                keys: "question",
                label: "Open shortcuts help",
                scope: "global",
            },
        ]
    }, [navigate])

    const keyboardShortcuts = useKeyboardShortcuts({
        routePath: location.pathname,
        shortcuts: shortcutDefinitions,
    })

    const filteredShortcuts = useMemo(() => {
        const normalizedQuery = shortcutsHelpQuery.trim().toLowerCase()
        if (normalizedQuery.length === 0) {
            return keyboardShortcuts.shortcuts
        }

        return keyboardShortcuts.shortcuts.filter((shortcut): boolean => {
            return `${shortcut.label} ${shortcut.keys} ${shortcut.scope}`
                .toLowerCase()
                .includes(normalizedQuery)
        })
    }, [keyboardShortcuts.shortcuts, shortcutsHelpQuery])

    return {
        conflicts: keyboardShortcuts.conflicts,
        filteredShortcuts,
        isShortcutsHelpOpen,
        setIsShortcutsHelpOpen,
        setShortcutsHelpQuery,
        shortcutsHelpQuery,
    }
}
