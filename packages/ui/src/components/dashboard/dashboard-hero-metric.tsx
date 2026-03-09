import { type ReactElement } from "react"

import { Card, CardBody } from "@/components/ui"
import { TYPOGRAPHY } from "@/lib/constants/typography"

/**
 * Свойства hero-метрики dashboard.
 */
export interface IDashboardHeroMetricProps {
    /** Название метрики. */
    readonly label: string
    /** Текущее значение. */
    readonly value: number
    /** Максимальное значение для gauge (по умолчанию 100). */
    readonly max?: number
    /** Цвет gauge (CSS variable или hex). */
    readonly color?: string
    /** Подпись снизу. */
    readonly subtitle?: string
}

/**
 * Вычисляет SVG arc path для radial gauge.
 *
 * @param percentage Процент заполнения (0-1).
 * @param radius Радиус дуги.
 * @param cx Центр X.
 * @param cy Центр Y.
 * @returns SVG path string.
 */
function describeArc(percentage: number, radius: number, cx: number, cy: number): string {
    const startAngle = -225
    const endAngle = startAngle + percentage * 270
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)
    const largeArc = percentage > 0.5 ? 1 : 0

    return `M ${String(x1)} ${String(y1)} A ${String(radius)} ${String(radius)} 0 ${String(largeArc)} 1 ${String(x2)} ${String(y2)}`
}

/**
 * Large hero metric card с radial gauge визуализацией.
 * Используется как Zone A элемент dashboard с progressive disclosure.
 *
 * @param props Конфигурация метрики.
 * @returns Hero metric card с gauge.
 */
export function DashboardHeroMetric(props: IDashboardHeroMetricProps): ReactElement {
    const max = props.max ?? 100
    const percentage = Math.min(1, Math.max(0, props.value / max))
    const color = props.color ?? "var(--primary)"
    const radius = 40
    const cx = 50
    const cy = 50

    return (
        <Card className="overflow-hidden">
            <CardBody className="flex flex-col items-center gap-2 py-6">
                <svg
                    aria-label={`${props.label}: ${String(props.value)}`}
                    className="h-28 w-28"
                    viewBox="0 0 100 100"
                >
                    <path
                        d={describeArc(1, radius, cx, cy)}
                        fill="none"
                        stroke="var(--border)"
                        strokeLinecap="round"
                        strokeWidth="6"
                    />
                    <path
                        d={describeArc(percentage, radius, cx, cy)}
                        fill="none"
                        stroke={color}
                        strokeLinecap="round"
                        strokeWidth="6"
                    />
                    <text
                        className="text-2xl font-bold"
                        dominantBaseline="middle"
                        fill="currentColor"
                        textAnchor="middle"
                        x={cx}
                        y={cy}
                    >
                        {String(props.value)}
                    </text>
                </svg>
                <p className={TYPOGRAPHY.sectionTitle}>{props.label}</p>
                {props.subtitle !== undefined ? (
                    <p className={TYPOGRAPHY.caption}>{props.subtitle}</p>
                ) : null}
            </CardBody>
        </Card>
    )
}
