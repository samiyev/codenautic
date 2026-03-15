import type { ReactElement } from "react"
import { motion } from "motion/react"

import { MetricCard, type IMetricCardProps, type TMetricTrendDirection } from "./metric-card"

/**
 * Stagger item animation variants for metric cards.
 */
const STAGGER_ITEM_VARIANTS = {
    hidden: {
        opacity: 0,
        y: 12,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.25,
            ease: [0.0, 0.0, 0.2, 1.0],
        },
    },
} as const

/**
 * Metric for the dashboard grid.
 */
export interface IMetricGridMetric extends IMetricCardProps {
    /** Metric identifier. */
    readonly id: string
}

/**
 * KPI grid props.
 */
export interface IMetricsGridProps {
    /** Metrics to display. */
    readonly metrics: ReadonlyArray<IMetricGridMetric>
}

/**
 * Renders a staggered KPI card grid.
 *
 * @param props Configuration.
 * @returns Animated grid of metric cards.
 */
export function MetricsGrid(props: IMetricsGridProps): ReactElement {
    return (
        <motion.section
            animate="visible"
            aria-label="KPI metrics"
            className="grid gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-4"
            initial="hidden"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.06 },
                },
            }}
        >
            {props.metrics.map((metric): ReactElement => {
                const { id, ...cardProps } = metric
                return (
                    <motion.div key={id} variants={STAGGER_ITEM_VARIANTS}>
                        <MetricCard {...cardProps} />
                    </motion.div>
                )
            })}
        </motion.section>
    )
}

/**
 * Available metric trend directions.
 */
export type { TMetricTrendDirection }
