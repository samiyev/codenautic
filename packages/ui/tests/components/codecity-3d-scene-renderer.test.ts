import { describe, expect, it } from "vitest"

import {
    createCodeCityBuildingMeshes,
    resolveCodeCityBuildingColor,
} from "@/components/graphs/codecity-3d-scene-renderer"
import type { ICodeCity3DSceneFileDescriptor } from "@/components/graphs/codecity-3d-scene"

describe("CodeCity3DSceneRenderer building generation", (): void => {
    it("строит здания из файлов по правилам height=LOC, width=complexity, color=coverage", (): void => {
        const files: ReadonlyArray<ICodeCity3DSceneFileDescriptor> = [
            {
                complexity: 32,
                coverage: 91,
                id: "src/core/auth.ts",
                loc: 240,
                path: "src/core/auth.ts",
            },
            {
                complexity: 8,
                coverage: 58,
                id: "src/core/cache.ts",
                loc: 96,
                path: "src/core/cache.ts",
            },
            {
                complexity: 3,
                coverage: undefined,
                id: "src/core/worker.ts",
                loc: 30,
                path: "src/core/worker.ts",
            },
        ]

        const buildings = createCodeCityBuildingMeshes(files)
        expect(buildings).toHaveLength(3)

        expect(buildings.at(0)).toMatchObject({
            color: "#22c55e",
            depth: 2.2,
            height: 10,
            id: "src/core/auth.ts",
            width: 3.4,
            x: -2,
            z: -2,
        })

        expect(buildings.at(1)).toMatchObject({
            color: "#fb923c",
            depth: 2.2,
            height: 4,
            id: "src/core/cache.ts",
            width: 1,
            x: 2,
            z: -2,
        })

        expect(buildings.at(2)).toMatchObject({
            color: "#facc15",
            depth: 2.2,
            height: 1.25,
            id: "src/core/worker.ts",
            width: 1,
            x: -2,
            z: 2,
        })
    })

    it("маппит coverage диапазоны в ожидаемые цвета", (): void => {
        expect(resolveCodeCityBuildingColor(undefined)).toBe("#facc15")
        expect(resolveCodeCityBuildingColor(90)).toBe("#22c55e")
        expect(resolveCodeCityBuildingColor(70)).toBe("#14b8a6")
        expect(resolveCodeCityBuildingColor(50)).toBe("#fb923c")
        expect(resolveCodeCityBuildingColor(40)).toBe("#ef4444")
    })
})
