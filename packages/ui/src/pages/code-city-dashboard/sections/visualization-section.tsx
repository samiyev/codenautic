import type { ReactElement } from "react"

import { ChurnComplexityScatter } from "@/components/graphs/churn-complexity-scatter"
import { CodeCity3DScene } from "@/components/graphs/codecity-3d-scene"
import { CodeCityTreemap } from "@/components/graphs/codecity-treemap"
import { HealthTrendChart } from "@/components/graphs/health-trend-chart"
import { PackageDependencyGraph } from "@/components/graphs/package-dependency-graph"
import { RootCauseChainViewer } from "@/components/graphs/root-cause-chain-viewer"
import { Card, CardBody, CardHeader } from "@/components/ui"

import {
    CODE_CITY_DASHBOARD_REPOSITORY_NODES,
    CODE_CITY_DASHBOARD_REPOSITORY_RELATIONS,
} from "../code-city-dashboard-mock-data"
import type { ICodeCityDashboardState } from "../use-code-city-dashboard-state"

/**
 * Параметры секции визуализации.
 */
export interface IVisualizationSectionProps {
    /** Состояние дашборда. */
    readonly state: ICodeCityDashboardState
}

/**
 * Секция визуализации: PackageDependency, 3D, Scatter, HealthTrend, RootCause, Treemap.
 *
 * @param props Конфигурация.
 * @returns Секция визуализации.
 */
export function VisualizationSection({ state }: IVisualizationSectionProps): ReactElement {
    return (
        <>
            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">
                        Cross-repository dependencies
                    </p>
                </CardHeader>
                <CardBody>
                    <PackageDependencyGraph
                        height="360px"
                        nodes={CODE_CITY_DASHBOARD_REPOSITORY_NODES}
                        relations={CODE_CITY_DASHBOARD_REPOSITORY_RELATIONS}
                        showControls={true}
                        showMiniMap={true}
                        title="Cross-repository package dependencies"
                    />
                </CardBody>
            </Card>

            <Card className={state.resolveTourCardClassName("city-3d")}>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">CodeCity 3D preview</p>
                </CardHeader>
                <CardBody>
                    <CodeCity3DScene
                        causalCouplings={state.overlayCausalCouplings}
                        files={state.currentProfile.files}
                        navigationActiveFileId={
                            state.overlayMode === "root-cause"
                                ? state.rootCauseChainFocus.activeFileId
                                : state.exploreNavigationFocus.activeFileId
                        }
                        navigationChainFileIds={
                            state.overlayMode === "root-cause"
                                ? state.rootCauseChainFocus.chainFileIds
                                : state.exploreNavigationFocus.chainFileIds
                        }
                        navigationLabel={
                            state.overlayMode === "root-cause"
                                ? state.rootCauseChainFocus.issueTitle
                                : state.exploreNavigationFocus.title
                        }
                        impactedFiles={state.overlayImpactedFiles}
                        title={`${state.currentProfile.label} 3D scene`}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">
                        Churn vs complexity side panel
                    </p>
                </CardHeader>
                <CardBody>
                    <ChurnComplexityScatter
                        files={state.currentProfile.files}
                        onFileSelect={state.setHighlightedFileId}
                        selectedFileId={state.highlightedFileId}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Health trend timeline</p>
                </CardHeader>
                <CardBody>
                    <HealthTrendChart points={state.currentProfile.healthTrend} />
                </CardBody>
            </Card>

            <Card className={state.resolveTourCardClassName("root-cause")}>
                <CardHeader>
                    <p className="text-sm font-semibold text-foreground">Root cause chain viewer</p>
                </CardHeader>
                <CardBody>
                    <RootCauseChainViewer
                        issues={state.overlayRootCauseIssues}
                        onChainFocusChange={state.handleRootCauseChainFocusChange}
                    />
                </CardBody>
            </Card>

            <Card>
                <CardBody>
                    <CodeCityTreemap
                        key={`${state.currentProfile.id}-${state.metric}`}
                        comparisonLabel={`${state.currentProfile.id}-baseline`}
                        compareFiles={state.currentProfile.compareFiles}
                        defaultMetric={state.metric}
                        fileLink={state.fileLink}
                        files={state.currentProfile.files}
                        highlightedFileId={state.highlightedFileId}
                        impactedFiles={state.overlayImpactedFiles}
                        fileColorById={state.ownershipFileColorById}
                        predictedRiskByFileId={state.predictedRiskByFileId}
                        packageColorByName={state.busFactorPackageColorByName}
                        temporalCouplings={state.overlayTemporalCouplings}
                        title={`${state.currentProfile.label} treemap`}
                    />
                </CardBody>
            </Card>
        </>
    )
}
