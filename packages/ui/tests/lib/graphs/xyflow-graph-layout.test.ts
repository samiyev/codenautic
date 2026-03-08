import { describe, expect, it } from "vitest"

import {
    calculateGraphLayout,
    type IGraphEdge,
    type IGraphNode,
} from "@/components/graphs/xyflow-graph-layout"

describe("calculateGraphLayout", (): void => {
    it("добавляет координаты для всех переданных нод", (): void => {
        const nodes: IGraphNode[] = [
            { id: "a", label: "A", width: 160, height: 60 },
            { id: "b", label: "B", width: 160, height: 60 },
            { id: "c", label: "C", width: 160, height: 60 },
        ]
        const edges: IGraphEdge[] = [
            { source: "a", target: "b", label: "depends" },
            { source: "b", target: "c", label: "depends" },
        ]

        const layouted = calculateGraphLayout(nodes, edges, {
            direction: "LR",
            nodeSpacingX: 100,
            nodeSpacingY: 100,
            margin: 12,
        })

        expect(layouted).toHaveLength(nodes.length)
        expect(layouted.map((node): string => node.id)).toEqual(["a", "b", "c"])
        expect(layouted.every((node): boolean => Number.isFinite(node.position.x))).toBe(true)
        expect(layouted.every((node): boolean => Number.isFinite(node.position.y))).toBe(true)
    })

    it("игнорирует рёбра с неизвестными узлами", (): void => {
        const nodes: IGraphNode[] = [{ id: "a", label: "A" }]
        const edges: IGraphEdge[] = [
            { source: "a", target: "missing" },
            { source: "missing", target: "a" },
        ]
        const layouted = calculateGraphLayout(nodes, edges)

        expect(layouted).toHaveLength(1)
        expect(layouted[0]?.id).toBe("a")
    })
})
