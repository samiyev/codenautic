/**
 * Предустановленные высоты для chart-контейнеров.
 */
export const CHART_HEIGHT = {
    xs: "h-48",
    sm: "h-56",
    md: "h-60",
    lg: "h-64",
    xl: "h-72",
} as const

/**
 * Порог устаревания данных в минутах (для stale indicator).
 */
export const CHART_STALE_THRESHOLD_MINUTES = 45

/**
 * Толщина линий графиков (strokeWidth).
 */
export const CHART_STROKE_WIDTH = 2

/**
 * Паттерн штриховой сетки (strokeDasharray).
 */
export const CHART_GRID_DASH = "3 3"

/**
 * Прозрачность заливки area charts (fillOpacity).
 */
export const CHART_FILL_OPACITY = 0.35

/**
 * Внешний радиус pie chart.
 */
export const PIE_OUTER_RADIUS = 84

/**
 * Множитель для расчёта violation score.
 */
export const VIOLATION_SCORE_MULTIPLIER = 5

/**
 * Fallback цвет для chart элементов через CSS-переменную.
 */
export const CHART_FALLBACK_COLOR = "var(--chart-primary)"
