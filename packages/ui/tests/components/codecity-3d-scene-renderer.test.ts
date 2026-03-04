import { describe, expect, it } from "vitest"

import {
    createCodeCityBuildingMeshes,
    createCodeCityDistrictMeshes,
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

        const firstBuilding = buildings.find((building): boolean => {
            return building.id === "src/core/auth.ts"
        })
        expect(firstBuilding).toMatchObject({
            color: "#22c55e",
            districtId: "core",
            height: 10,
            id: "src/core/auth.ts",
            width: 3.4,
        })
        expect(firstBuilding?.depth).toBeGreaterThan(0.5)
        expect(firstBuilding?.x).toBeTypeOf("number")
        expect(firstBuilding?.z).toBeTypeOf("number")

        const secondBuilding = buildings.find((building): boolean => {
            return building.id === "src/core/cache.ts"
        })
        expect(secondBuilding).toMatchObject({
            color: "#fb923c",
            districtId: "core",
            height: 4,
            id: "src/core/cache.ts",
            width: 1,
        })
        expect(secondBuilding?.depth).toBeGreaterThan(0.5)
        expect(secondBuilding?.x).toBeTypeOf("number")
        expect(secondBuilding?.z).toBeTypeOf("number")

        const thirdBuilding = buildings.find((building): boolean => {
            return building.id === "src/core/worker.ts"
        })
        expect(thirdBuilding).toMatchObject({
            color: "#facc15",
            districtId: "core",
            height: 1.25,
            id: "src/core/worker.ts",
            width: 1,
        })
        expect(thirdBuilding?.depth).toBeGreaterThan(0.5)
        expect(thirdBuilding?.x).toBeTypeOf("number")
        expect(thirdBuilding?.z).toBeTypeOf("number")
    })

    it("маппит coverage диапазоны в ожидаемые цвета", (): void => {
        expect(resolveCodeCityBuildingColor(undefined)).toBe("#facc15")
        expect(resolveCodeCityBuildingColor(90)).toBe("#22c55e")
        expect(resolveCodeCityBuildingColor(70)).toBe("#14b8a6")
        expect(resolveCodeCityBuildingColor(50)).toBe("#fb923c")
        expect(resolveCodeCityBuildingColor(40)).toBe("#ef4444")
    })

    it("группирует здания по районам и строит district layout с labels", (): void => {
        const files: ReadonlyArray<ICodeCity3DSceneFileDescriptor> = [
            {
                complexity: 16,
                coverage: 80,
                id: "src/api/auth.ts",
                loc: 120,
                path: "src/api/auth.ts",
            },
            {
                complexity: 12,
                coverage: 74,
                id: "src/worker/index.ts",
                loc: 95,
                path: "src/worker/index.ts",
            },
            {
                complexity: 22,
                coverage: 88,
                id: "src/ui/dashboard.tsx",
                loc: 180,
                path: "src/ui/dashboard.tsx",
            },
        ]

        const districts = createCodeCityDistrictMeshes(files)
        expect(districts).toHaveLength(3)
        const districtIds = districts
            .map((district): string => district.id)
            .sort((leftDistrict, rightDistrict): number => {
                return leftDistrict.localeCompare(rightDistrict)
            })
        expect(districtIds).toEqual(["api", "ui", "worker"])
        for (const district of districts) {
            expect(district.label.length).toBeGreaterThan(0)
            expect(district.width).toBeGreaterThan(0)
            expect(district.depth).toBeGreaterThan(0)
        }

        const buildings = createCodeCityBuildingMeshes(files)
        const buildingDistrictIds = buildings.map((building): string => building.districtId)
        expect(buildingDistrictIds).toContain("api")
        expect(buildingDistrictIds).toContain("ui")
        expect(buildingDistrictIds).toContain("worker")
    })
})
