/**
 * Конфигурация Recharts animation props.
 * Recharts animation is disabled globally for performance — large datasets
 * cause janky transitions. This is a deliberate choice, not a workaround.
 * Это обеспечивает корректное поведение при prefers-reduced-motion
 * и устраняет визуальные задержки при переключении данных.
 *
 * @example
 * ```tsx
 * <Line {...CHART_DATA_TRANSITION} dataKey="value" />
 * ```
 */
export const CHART_DATA_TRANSITION = {
    animationDuration: 0,
    isAnimationActive: false,
} as const

/**
 * Alias для обратной совместимости.
 */
export const CHART_DATA_TRANSITION_NONE = CHART_DATA_TRANSITION
