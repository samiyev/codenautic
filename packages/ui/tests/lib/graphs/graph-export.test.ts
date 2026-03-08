import { describe, expect, it, vi } from "vitest"

import {
    buildGraphExportFileName,
    resolveGraphPngCanvasSize,
    buildGraphSvg,
    exportGraphAsJson,
    exportGraphAsSvg,
} from "@/components/graphs/graph-export"
import type { IGraphLayoutNode } from "@/components/graphs/xyflow-graph-layout"

describe("graph-export", (): void => {
    it("нормализует название файла под export", (): void => {
        expect(buildGraphExportFileName("File Dependency Graph")).toBe("file-dependency-graph")
        expect(buildGraphExportFileName("   @@@   ")).toBe("graph-export")
    })

    it("строит fallback SVG при пустом графе", (): void => {
        const svgPayload = buildGraphSvg("Empty Graph", [], [])

        expect(svgPayload).toContain("No graph data")
        expect(svgPayload).toContain("<svg")
        expect(svgPayload).toContain("</svg>")
    })

    it("строит SVG-контур с безопасным title, nodes и edges", (): void => {
        const nodes: ReadonlyArray<IGraphLayoutNode> = [
            {
                id: "file-a",
                label: "<src/index.ts>",
                width: 200,
                height: 60,
                position: { x: 0, y: 0 },
            },
            {
                id: "file-b",
                label: "src/utils.ts",
                width: 200,
                height: 60,
                position: { x: 320, y: 80 },
            },
        ]
        const edges = [
            {
                source: "file-a",
                target: "file-b",
                label: "runtime",
            },
        ] as const

        const svgPayload = buildGraphSvg("Graph & <details>", nodes, edges)

        expect(svgPayload).toContain("<svg")
        expect(svgPayload).toContain("&lt;details&gt;")
        expect(svgPayload).toContain("runtime")
        expect(svgPayload).toContain("src/index.ts")
    })

    it("ограничивает png canvas по размеру стороны и общему числу пикселей", (): void => {
        expect(resolveGraphPngCanvasSize(1280, 720)).toEqual({
            height: 720,
            width: 1280,
        })

        const resized = resolveGraphPngCanvasSize(12000, 9000)
        expect(resized.width).toBeLessThanOrEqual(4096)
        expect(resized.height).toBeLessThanOrEqual(4096)
        expect(resized.width * resized.height).toBeLessThanOrEqual(16_777_216)
    })

    it("ошибается на невалидных размерах png canvas", (): void => {
        expect((): void => {
            resolveGraphPngCanvasSize(0, 800)
        }).toThrowError("Unable to resolve PNG export canvas size")
    })

    it("скачивает SVG как blob при вызове экспорта", (): void => {
        const createObjectUrl = vi
            .spyOn(URL, "createObjectURL")
            .mockReturnValue("blob:graph-export")
        const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

        try {
            exportGraphAsSvg("Graph file", [], [])

            expect(createObjectUrl).toHaveBeenCalledTimes(1)
            expect(clickSpy).toHaveBeenCalledTimes(1)
            expect(revokeObjectUrl).toHaveBeenCalledTimes(1)
        } finally {
            createObjectUrl.mockRestore()
            revokeObjectUrl.mockRestore()
            clickSpy.mockRestore()
        }
    })

    it("скачивает JSON-файл для aggregated fallback данных", (): void => {
        const createObjectUrl = vi
            .spyOn(URL, "createObjectURL")
            .mockReturnValue("blob:graph-export-json")
        const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

        try {
            exportGraphAsJson("Huge Graph fallback", {
                sampledPaths: [{ source: "a", target: "b" }],
                topHubs: [{ id: "a", degree: 8 }],
            })

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
