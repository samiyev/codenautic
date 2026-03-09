import type { ReactElement } from "react"
import { CartesianGrid, Line, LineChart, ReferenceDot, Tooltip, XAxis, YAxis } from "recharts"

import { Alert, Card, CardBody, CardHeader } from "@/components/ui"
import { ChartContainer } from "@/components/charts/chart-container"
import { CHART_GRID_DASH, CHART_STROKE_WIDTH } from "@/lib/constants/chart-constants"
import { TYPOGRAPHY } from "@/lib/constants/typography"

import {
    BLUEPRINT_STRUCTURE_NODES,
    DRIFT_TREND_POINTS,
    REALITY_STRUCTURE_NODES,
} from "../contract-validation-mock-data"
import { resolveArchitectureDifferenceBadgeClass } from "../drift-analysis-utils"
import type { IContractValidationState } from "../use-contract-validation-state"

/**
 * Props for the drift trend section.
 */
export interface IDriftTrendSectionProps {
    /**
     * Shared contract validation page state.
     */
    readonly state: IContractValidationState
}

/**
 * Drift trend section: drift score line chart with architecture change annotations,
 * blueprint vs reality comparison view, difference summary and difference list.
 *
 * @param props Component props.
 * @returns The drift trend section element.
 */
export function DriftTrendSection({ state }: IDriftTrendSectionProps): ReactElement {
    return (
        <>
            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.sectionTitle}>Blueprint vs reality view</p>
                </CardHeader>
                <CardBody className="space-y-3">
                    <p className="text-sm text-text-secondary">
                        Compare intended architecture from blueprint with actual runtime structure.
                        Differences are color-coded to highlight missing and unexpected modules.
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                        <div>
                            <p className="mb-2 text-sm font-semibold text-foreground">
                                Intended architecture
                            </p>
                            <ul
                                aria-label="Blueprint intended architecture list"
                                className="space-y-2"
                            >
                                {BLUEPRINT_STRUCTURE_NODES.map(
                                    (node): ReactElement => (
                                        <li
                                            className="rounded border border-border bg-surface p-2 text-xs"
                                            key={node.id}
                                        >
                                            <p className="font-semibold text-foreground">
                                                {node.layer} / {node.module}
                                            </p>
                                            <p className="text-muted-foreground">
                                                Depends on:{" "}
                                                {node.dependsOn.length === 0
                                                    ? "\u2014"
                                                    : node.dependsOn.join(", ")}
                                            </p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                        <div>
                            <p className="mb-2 text-sm font-semibold text-foreground">
                                Runtime structure
                            </p>
                            <ul aria-label="Reality architecture list" className="space-y-2">
                                {REALITY_STRUCTURE_NODES.map(
                                    (node): ReactElement => (
                                        <li
                                            className="rounded border border-border bg-surface p-2 text-xs"
                                            key={node.id}
                                        >
                                            <p className="font-semibold text-foreground">
                                                {node.layer} / {node.module}
                                            </p>
                                            <p className="text-muted-foreground">
                                                Depends on:{" "}
                                                {node.dependsOn.length === 0
                                                    ? "\u2014"
                                                    : node.dependsOn.join(", ")}
                                            </p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                    </div>
                    <Alert color="primary" title="Difference summary" variant="flat">
                        {state.architectureDifferenceSummary}
                    </Alert>
                    <ul aria-label="Architecture differences list" className="space-y-2">
                        {state.architectureDifferences.map(
                            (difference): ReactElement => (
                                <li
                                    className="rounded border border-border bg-surface p-2 text-xs"
                                    key={difference.id}
                                >
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-foreground">
                                            {difference.layer} / {difference.module}
                                        </span>
                                        <span
                                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${resolveArchitectureDifferenceBadgeClass(
                                                difference.status,
                                            )}`}
                                        >
                                            {difference.status}
                                        </span>
                                    </div>
                                    <p className="text-foreground">{difference.description}</p>
                                </li>
                            ),
                        )}
                    </ul>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className={TYPOGRAPHY.sectionTitle}>Drift trend chart</p>
                </CardHeader>
                <CardBody className="space-y-3">
                    <p className="text-sm text-text-secondary">
                        Drift score trend over time with architecture change annotations.
                    </p>
                    <ChartContainer aria-label="Drift score trend chart" height="xl">
                        <LineChart
                            data={DRIFT_TREND_POINTS}
                            margin={{
                                bottom: 8,
                                left: 8,
                                right: 12,
                                top: 12,
                            }}
                        >
                            <CartesianGrid strokeDasharray={CHART_GRID_DASH} />
                            <XAxis dataKey="period" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Line
                                activeDot={{ r: 6 }}
                                dataKey="driftScore"
                                dot={{
                                    fill: "var(--chart-primary)",
                                    r: 3,
                                    stroke: "var(--background)",
                                    strokeWidth: 1,
                                }}
                                stroke="var(--chart-primary)"
                                strokeWidth={CHART_STROKE_WIDTH}
                                type="monotone"
                            />
                            {state.driftTrendAnnotations.map(
                                (point): ReactElement => (
                                    <ReferenceDot
                                        fill="var(--chart-danger)"
                                        key={`${point.period}-annotation`}
                                        r={5}
                                        stroke="var(--background)"
                                        strokeWidth={1}
                                        x={point.period}
                                        y={point.driftScore}
                                    />
                                ),
                            )}
                        </LineChart>
                    </ChartContainer>
                    <Alert color="primary" title="Trend summary" variant="flat">
                        {state.driftTrendSummary}
                    </Alert>
                    <ul
                        aria-label="Architecture change annotations list"
                        className="space-y-1 text-sm"
                    >
                        {state.driftTrendAnnotations.map(
                            (point): ReactElement => (
                                <li key={`${point.period}-${String(point.driftScore)}`}>
                                    <span className="font-semibold">{point.period}</span>:{" "}
                                    {point.architectureChange}
                                </li>
                            ),
                        )}
                    </ul>
                </CardBody>
            </Card>
        </>
    )
}
