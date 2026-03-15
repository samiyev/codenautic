import type { ReactElement } from "react"

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts"

import { Card, CardContent, CardHeader, Chip } from "@heroui/react"
import { TYPOGRAPHY } from "@/lib/constants/typography"
import { CHART_FILL_OPACITY } from "@/lib/constants/chart-recharts-defaults"
import { VIOLATION_SCORE_MULTIPLIER } from "@/lib/constants/chart-constants"

interface IArchitectureHealthWidgetProps {
    /** Общий health score. */
    readonly healthScore: number
    /** Количество layer violations. */
    readonly layerViolations: number
    /** DDD compliance score. */
    readonly dddCompliance: number
}

/**
 * Architecture health dashboard widget с glass morphism.
 *
 * @param props Метрики архитектурного состояния.
 * @returns Карточка health/violations/compliance.
 */
export function ArchitectureHealthWidget(props: IArchitectureHealthWidgetProps): ReactElement {
    const radarData = [
        { metric: "Health", value: props.healthScore },
        { metric: "DDD", value: props.dddCompliance },
        {
            metric: "Layer rules",
            value: Math.max(0, 100 - props.layerViolations * VIOLATION_SCORE_MULTIPLIER),
        },
    ]

    return (
        <Card className="border border-border/60 bg-surface/80 backdrop-blur-sm">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                <p className={TYPOGRAPHY.sectionTitle}>Architecture health</p>
                <div className="flex flex-wrap items-center gap-2">
                    <Chip color="accent" size="sm" variant="soft">
                        {`Health ${String(props.healthScore)}`}
                    </Chip>
                    <Chip
                        className={props.layerViolations > 5 ? "badge-pulse" : ""}
                        color="accent"
                        size="sm"
                        variant="soft"
                    >
                        {`Violations ${String(props.layerViolations)}`}
                    </Chip>
                    <Chip color="accent" size="sm" variant="soft">
                        {`DDD ${String(props.dddCompliance)}%`}
                    </Chip>
                </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
                <p className={TYPOGRAPHY.bodyMuted}>
                    Health score, layer violations and DDD compliance in one architecture widget.
                </p>
                {radarData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <h3 className={TYPOGRAPHY.subsectionTitle}>No data</h3>
                        <p className="max-w-sm text-sm text-muted">No architecture health data available.</p>
                    </div>
                ) : (
                    <div className="h-60 w-full"><ResponsiveContainer height="100%" minHeight={1} minWidth={1} width="100%">
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="var(--chart-grid)" strokeOpacity={0.5} />
                            <PolarAngleAxis
                                dataKey="metric"
                                tick={{ fill: "var(--muted)", fontSize: 11 }}
                            />
                            <PolarRadiusAxis
                                angle={30}
                                domain={[0, 100]}
                                tick={{ fill: "var(--muted)", fontSize: 10 }}
                            />
                            <Radar
                                {...{ animationDuration: 0, isAnimationActive: false }}
                                dataKey="value"
                                fill="var(--chart-primary)"
                                fillOpacity={CHART_FILL_OPACITY}
                                name="Architecture"
                                stroke="var(--chart-primary)"
                                strokeWidth={2}
                            />
                        </RadarChart>
                    </ResponsiveContainer></div>
                )}
            </CardContent>
        </Card>
    )
}

export type { IArchitectureHealthWidgetProps }
