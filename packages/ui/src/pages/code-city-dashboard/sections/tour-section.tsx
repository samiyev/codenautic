import type { ReactElement } from "react"

import { GuidedTourOverlay } from "@/components/graphs/guided-tour-overlay"
import { TourCustomizer } from "@/components/graphs/tour-customizer"
import { Card, CardBody, CardHeader } from "@/components/ui"

import type { ICodeCityDashboardState } from "../use-code-city-dashboard-state"

/**
 * Параметры секции тура.
 */
export interface ITourSectionProps {
    /** Состояние дашборда. */
    readonly state: ICodeCityDashboardState
}

/**
 * Секция тура: GuidedTourOverlay + TourCustomizer.
 *
 * @param props Конфигурация.
 * @returns Секция тура.
 */
export function TourSection({ state }: ITourSectionProps): ReactElement {
    return (
        <>
            <GuidedTourOverlay
                currentStepIndex={state.guidedTourStepIndex}
                isActive={state.isGuidedTourActive}
                onNext={state.handleTourNext}
                onPrevious={state.handleTourPrevious}
                onSkip={state.handleTourSkip}
                steps={state.guidedTourSteps}
            />
            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Tour customizer</p>
                </CardHeader>
                <CardBody>
                    <TourCustomizer
                        isAdmin={true}
                        onStepsChange={state.handleTourStepsChange}
                        steps={state.guidedTourSteps}
                    />
                </CardBody>
            </Card>
        </>
    )
}
