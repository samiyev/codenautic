import type { ReactElement } from "react"

import { CityImpactOverlay } from "@/components/graphs/city-impact-overlay"
import { CityRefactoringOverlay } from "@/components/graphs/city-refactoring-overlay"
import { ImpactAnalysisPanel } from "@/components/graphs/impact-analysis-panel"
import { RefactoringDashboard } from "@/components/graphs/refactoring-dashboard"
import { RefactoringExportDialog } from "@/components/graphs/refactoring-export-dialog"
import { RefactoringTimeline } from "@/components/graphs/refactoring-timeline"
import { ROICalculatorWidget } from "@/components/graphs/roi-calculator-widget"
import { SimulationPanel } from "@/components/graphs/simulation-panel"
import { Card, CardBody, CardHeader } from "@/components/ui"

import type { ICodeCityDashboardState } from "../use-code-city-dashboard-state"

/**
 * Параметры секции рефакторинга.
 */
export interface IRefactoringSectionProps {
    /** Состояние дашборда. */
    readonly state: ICodeCityDashboardState
}

/**
 * Секция рефакторинга: Dashboard, ROI, CityOverlay, Simulation, Timeline, Export, Impact.
 *
 * @param props Конфигурация.
 * @returns Секция рефакторинга.
 */
export function RefactoringSection({ state }: IRefactoringSectionProps): ReactElement {
    return (
        <>
            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Refactoring dashboard</p>
                </CardHeader>
                <CardBody>
                    <RefactoringDashboard
                        onSelectTarget={(target): void => {
                            state.setHighlightedFileId(target.fileId)
                            state.setExploreNavigationFocus({
                                activeFileId: target.fileId,
                                chainFileIds: [target.fileId],
                                title: `Refactor target: ${target.title}`,
                            })
                            state.markAreaExplored("city-3d")
                        }}
                        targets={state.refactoringTargets}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">ROI calculator widget</p>
                </CardHeader>
                <CardBody>
                    <ROICalculatorWidget
                        onApplyScenario={(fileIds): void => {
                            const primaryFileId = fileIds[0]
                            if (primaryFileId !== undefined) {
                                state.setHighlightedFileId(primaryFileId)
                            }
                            state.setExploreNavigationFocus({
                                activeFileId: primaryFileId,
                                chainFileIds: fileIds,
                                title: "ROI scenario",
                            })
                            state.markAreaExplored("city-3d")
                        }}
                        targets={state.refactoringTargets}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">
                        City refactoring overlay
                    </p>
                </CardHeader>
                <CardBody>
                    <CityRefactoringOverlay
                        entries={state.cityRefactoringOverlayEntries}
                        onSelectEntry={(entry): void => {
                            state.setHighlightedFileId(entry.fileId)
                            state.setExploreNavigationFocus({
                                activeFileId: entry.fileId,
                                chainFileIds: [entry.fileId],
                                title: `Refactor overlay: ${entry.label}`,
                            })
                            state.markAreaExplored("city-3d")
                        }}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Simulation panel</p>
                </CardHeader>
                <CardBody>
                    <SimulationPanel
                        onPreviewScenario={(scenario): void => {
                            const primaryFileId = scenario.fileIds[0]
                            if (primaryFileId !== undefined) {
                                state.setHighlightedFileId(primaryFileId)
                            }
                            state.setExploreNavigationFocus({
                                activeFileId: primaryFileId,
                                chainFileIds: scenario.fileIds,
                                title:
                                    scenario.mode === "after"
                                        ? "Simulation after refactoring"
                                        : "Simulation baseline",
                            })
                            state.markAreaExplored("city-3d")
                        }}
                        targets={state.refactoringTargets}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Refactoring timeline</p>
                </CardHeader>
                <CardBody>
                    <RefactoringTimeline
                        onSelectTask={(task): void => {
                            state.setHighlightedFileId(task.fileId)
                            state.setExploreNavigationFocus({
                                activeFileId: task.fileId,
                                chainFileIds: [task.fileId],
                                title: `Refactoring timeline: ${task.title}`,
                            })
                            state.markAreaExplored("city-3d")
                        }}
                        tasks={state.refactoringTimelineTasks}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">
                        Refactoring export dialog
                    </p>
                </CardHeader>
                <CardBody>
                    <RefactoringExportDialog
                        onExport={(payload): void => {
                            const primaryFileId = payload.fileIds[0]
                            if (primaryFileId !== undefined) {
                                state.setHighlightedFileId(primaryFileId)
                            }
                            state.setExploreNavigationFocus({
                                activeFileId: primaryFileId,
                                chainFileIds: payload.fileIds,
                                title: `Export plan: ${payload.destination}`,
                            })
                            state.markAreaExplored("city-3d")
                        }}
                        targets={state.refactoringTargets}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Impact analysis panel</p>
                </CardHeader>
                <CardBody>
                    <ImpactAnalysisPanel
                        onApplyImpact={(selection): void => {
                            state.setHighlightedFileId(selection.fileId)
                            state.setExploreNavigationFocus({
                                activeFileId: selection.fileId,
                                chainFileIds: [
                                    selection.fileId,
                                    ...selection.affectedFiles.filter((fileId): boolean => {
                                        return fileId !== selection.fileId
                                    }),
                                ],
                                title: `Impact analysis: ${selection.label}`,
                            })
                            state.markAreaExplored("city-3d")
                        }}
                        seeds={state.impactAnalysisSeeds}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">City impact overlay</p>
                </CardHeader>
                <CardBody>
                    <CityImpactOverlay
                        entries={state.cityImpactOverlayEntries}
                        onSelectEntry={(entry): void => {
                            state.setHighlightedFileId(entry.fileId)
                            state.setExploreNavigationFocus({
                                activeFileId: entry.fileId,
                                chainFileIds: [entry.fileId],
                                title: `Impact overlay: ${entry.label}`,
                            })
                            state.markAreaExplored("city-3d")
                        }}
                    />
                </CardBody>
            </Card>
        </>
    )
}
