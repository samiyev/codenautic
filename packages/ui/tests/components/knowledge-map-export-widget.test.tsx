import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    KnowledgeMapExportWidget,
    type TKnowledgeMapExportFormat,
} from "@/components/team-analytics/knowledge-map-export-widget"
import { renderWithProviders } from "../utils/render"

const { mockExportKnowledgeMapAsSvg, mockExportKnowledgeMapAsPng } = vi.hoisted(() => ({
    mockExportKnowledgeMapAsSvg: vi.fn(),
    mockExportKnowledgeMapAsPng: vi.fn(async (): Promise<void> => {}),
}))

vi.mock("@/components/team-analytics/knowledge-map-export", () => ({
    exportKnowledgeMapAsPng: mockExportKnowledgeMapAsPng,
    exportKnowledgeMapAsSvg: mockExportKnowledgeMapAsSvg,
}))

const TEST_MODEL = {
    metadata: {
        generatedAt: "2026-03-05T10:00:00.000Z",
        metricLabel: "Complexity",
        repositoryId: "platform-team/api-gateway",
        repositoryLabel: "platform-team/api-gateway",
        totalContributors: 4,
        totalFiles: 16,
    },
    owners: [
        {
            color: "#0284c7",
            fileCount: 6,
            ownerName: "Neo",
        },
        {
            color: "#0ea5e9",
            fileCount: 4,
            ownerName: "Trinity",
        },
    ],
    districts: [
        {
            busFactor: 1,
            districtLabel: "src/api",
            riskLabel: "Critical",
        },
    ],
    silos: [
        {
            contributorCount: 1,
            fileCount: 5,
            riskScore: 84,
            siloLabel: "src/api",
        },
    ],
} as const

describe("KnowledgeMapExportWidget", (): void => {
    it("рендерит metadata и legend preview для knowledge map", (): void => {
        renderWithProviders(<KnowledgeMapExportWidget model={TEST_MODEL} />)

        expect(screen.getByText("Knowledge map export")).not.toBeNull()
        expect(screen.getByLabelText("Knowledge map metadata")).not.toBeNull()
        expect(screen.getByText("Repository: platform-team/api-gateway")).not.toBeNull()
        expect(screen.getByLabelText("Knowledge map legend")).not.toBeNull()
        expect(screen.getByText("Neo · files 6")).not.toBeNull()
        expect(screen.getByText("src/api · bus factor 1 · Critical")).not.toBeNull()
    })

    it("выполняет экспорт в SVG/PNG и вызывает onExport callback", async (): Promise<void> => {
        const user = userEvent.setup()
        const onExport = vi.fn<(format: TKnowledgeMapExportFormat) => void>()
        renderWithProviders(<KnowledgeMapExportWidget model={TEST_MODEL} onExport={onExport} />)

        await user.click(screen.getByRole("button", { name: "Export knowledge map as SVG" }))
        await user.click(screen.getByRole("button", { name: "Export knowledge map as PNG" }))

        expect(mockExportKnowledgeMapAsSvg).toHaveBeenCalledTimes(1)
        expect(mockExportKnowledgeMapAsSvg).toHaveBeenCalledWith(TEST_MODEL)
        expect(mockExportKnowledgeMapAsPng).toHaveBeenCalledTimes(1)
        expect(mockExportKnowledgeMapAsPng).toHaveBeenCalledWith(TEST_MODEL)
        expect(onExport).toHaveBeenCalledTimes(2)
        expect(onExport).toHaveBeenNthCalledWith(1, "svg")
        expect(onExport).toHaveBeenNthCalledWith(2, "png")
    })
})
