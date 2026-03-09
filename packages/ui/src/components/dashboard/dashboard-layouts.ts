/**
 * Конфигурация видимости dashboard зон по layout preset.
 */
export interface IDashboardLayoutPreset {
    /** Идентификатор пресета. */
    readonly id: string
    /** Отображаемое имя. */
    readonly label: string
    /** Видимость Zone B (primary charts). */
    readonly showZoneB: boolean
    /** Видимость Zone C (team activity). */
    readonly showZoneC: boolean
    /** Видимость Zone D (architecture). */
    readonly showZoneD: boolean
    /** Видимость Zone E (token usage). */
    readonly showZoneE: boolean
    /** Видимость Zone F (status distribution). */
    readonly showZoneF: boolean
}

/**
 * Предустановленные layout пресеты для dashboard.
 */
export const DASHBOARD_LAYOUT_PRESETS: ReadonlyArray<IDashboardLayoutPreset> = [
    {
        id: "balanced",
        label: "Balanced",
        showZoneB: true,
        showZoneC: true,
        showZoneD: true,
        showZoneE: true,
        showZoneF: true,
    },
    {
        id: "focus",
        label: "Focus",
        showZoneB: true,
        showZoneC: false,
        showZoneD: true,
        showZoneE: false,
        showZoneF: false,
    },
    {
        id: "ops",
        label: "Operations",
        showZoneB: true,
        showZoneC: true,
        showZoneD: false,
        showZoneE: true,
        showZoneF: true,
    },
] as const

/**
 * Возвращает layout preset по ID с fallback на balanced.
 *
 * @param presetId ID пресета.
 * @returns Найденный пресет или balanced по умолчанию.
 */
export function resolveDashboardLayoutPreset(presetId: string): IDashboardLayoutPreset {
    const found = DASHBOARD_LAYOUT_PRESETS.find((preset): boolean => preset.id === presetId)
    const fallback = DASHBOARD_LAYOUT_PRESETS[0]
    if (found !== undefined) {
        return found
    }
    if (fallback !== undefined) {
        return fallback
    }
    return {
        id: "balanced",
        label: "Balanced",
        showZoneB: true,
        showZoneC: true,
        showZoneD: true,
        showZoneE: true,
        showZoneF: true,
    }
}
