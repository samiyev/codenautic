/**
 * Семантическая палитра для SVG-экспорта графов и chart-визуализаций.
 * Группирует цвета по домену: knowledge map, graph export, forecast, bus factor, report.
 */
export const GRAPH_EXPORT_PALETTE = {
    /** Цвета SVG-экспорта knowledge map snapshot. */
    knowledgeMap: {
        background: "#020617",
        sectionFill: "#0f172a",
        sectionStroke: "#1e293b",
        headerTitle: "#f8fafc",
        subtitle: "#94a3b8",
        sectionTitle: "#e2e8f0",
        metadataText: "#cbd5e1",
        fallbackColor: "#94a3b8",
    },
    /** Цвета SVG-экспорта graph layout (узлы + рёбра). */
    graphLayout: {
        background: "#020617",
        emptyBackground: "#0f172a",
        emptyText: "#f8fafc",
        titleText: "#e2e8f0",
        nodeFill: "#111827",
        nodeStroke: "#38bdf8",
        nodeLabel: "#e2e8f0",
        edgeStroke: "#22c55e",
        edgeLabel: "#94a3b8",
    },
    /** Цвета trend forecast chart. */
    forecast: {
        zoneFill: "#e2e8f0",
        confidenceFill: "#67e8f9",
        historicalStroke: "#0f172a",
        lineStroke: "#0891b2",
    },
    /** Палитра серий bus factor trend chart. */
    busFactor: {
        seriesColors: ["#0284c7", "#7c3aed", "#059669", "#d97706", "#dc2626"] as const,
    },
    /** Цвет акцента по умолчанию для report template branding. */
    report: {
        defaultAccentColor: "#2563eb",
    },
} as const

/**
 * Возвращает текущую палитру SVG-экспорта.
 * На данном этапе возвращает статические значения.
 * В будущем — theme-aware resolver через CSS custom properties.
 *
 * @returns Полная палитра для SVG-генератора.
 */
export function resolveGraphExportPalette(): typeof GRAPH_EXPORT_PALETTE {
    return GRAPH_EXPORT_PALETTE
}
