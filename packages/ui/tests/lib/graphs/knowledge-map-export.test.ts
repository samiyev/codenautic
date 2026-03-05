import { describe, expect, it, vi } from "vitest"

import {
    buildKnowledgeMapExportFileName,
    buildKnowledgeMapExportSvg,
    exportKnowledgeMapAsSvg,
    type IKnowledgeMapExportModel,
} from "@/components/graphs/knowledge-map-export"

const TEST_MODEL: IKnowledgeMapExportModel = {
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
            ownerName: "Alice Rivera",
        },
        {
            color: "#e879f9",
            fileCount: 4,
            ownerName: "Max H.",
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
}

describe("knowledge-map-export", (): void => {
    it("нормализует file name для knowledge map snapshot", (): void => {
        expect(buildKnowledgeMapExportFileName("Platform Team / API Gateway")).toBe(
            "platform-team-api-gateway-knowledge-map",
        )
    })

    it("строит SVG со встроенными legend и metadata", (): void => {
        const svgPayload = buildKnowledgeMapExportSvg(TEST_MODEL)

        expect(svgPayload).toContain("<svg")
        expect(svgPayload).toContain("Knowledge Map Snapshot")
        expect(svgPayload).toContain("Metadata")
        expect(svgPayload).toContain("Legend — Ownership")
        expect(svgPayload).toContain("Legend — Bus Factor Risk")
        expect(svgPayload).toContain("src/api • risk 84")
        expect(svgPayload).toContain(
            "&quot;repositoryId&quot;:&quot;platform-team/api-gateway&quot;",
        )
    })

    it("скачивает knowledge map как SVG blob", (): void => {
        const createObjectUrl = vi
            .spyOn(URL, "createObjectURL")
            .mockReturnValue("blob:knowledge-map-export")
        const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

        try {
            exportKnowledgeMapAsSvg(TEST_MODEL)

            expect(createObjectUrl).toHaveBeenCalledTimes(1)
            expect(clickSpy).toHaveBeenCalledTimes(1)
            expect(revokeObjectUrl).toHaveBeenCalledTimes(1)
        } finally {
            createObjectUrl.mockRestore()
            revokeObjectUrl.mockRestore()
            clickSpy.mockRestore()
        }
    })
})
