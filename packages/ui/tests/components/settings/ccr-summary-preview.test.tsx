import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CCRSummaryPreview } from "@/components/settings/ccr-summary-preview"
import { renderWithProviders } from "../../utils/render"

describe("CCRSummaryPreview", (): void => {
    it("показывает выключенное состояние", (): void => {
        renderWithProviders(
            <CCRSummaryPreview
                settings={{
                    enabled: false,
                    includeRiskOverview: true,
                    includeTimeline: true,
                    detailLevel: "STANDARD",
                    maxSuggestions: 8,
                }}
            />,
        )

        expect(screen.getByTestId("ccr-summary-preview")).toHaveTextContent(
            "Summary generation is disabled.",
        )
    })

    it("рендерит detail level, max suggestions и секции", (): void => {
        renderWithProviders(
            <CCRSummaryPreview
                settings={{
                    enabled: true,
                    includeRiskOverview: false,
                    includeTimeline: true,
                    detailLevel: "DEEP",
                    maxSuggestions: 12,
                }}
            />,
        )

        expect(screen.getByTestId("ccr-summary-preview-detail-level")).toHaveTextContent(
            "Detail level: Deep",
        )
        expect(screen.getByTestId("ccr-summary-preview-max-suggestions")).toHaveTextContent(
            "Max suggestions: 12",
        )
        expect(screen.getByText("Timeline highlights")).not.toBeNull()
        expect(screen.getByText("Top actionable suggestions")).not.toBeNull()
    })
})
