import { useMemo, type ReactElement } from "react"
import { OrbitControls } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import type { ICodeCity3DSceneFileDescriptor } from "./codecity-3d-scene"

interface ICodeCity3DSceneRendererProps {
    readonly files: ReadonlyArray<ICodeCity3DSceneFileDescriptor>
}

/**
 * Подготовленная геометрия здания в 3D CodeCity.
 */
export interface ICodeCityBuildingMesh {
    readonly id: string
    readonly x: number
    readonly z: number
    readonly width: number
    readonly depth: number
    readonly height: number
    readonly color: string
}

const BASE_GRID_SPACING = 4
const MIN_BUILDING_WIDTH = 1
const MAX_BUILDING_WIDTH = 3.4
const MIN_BUILDING_HEIGHT = 1.2
const BUILDING_DEPTH = 2.2
const COMPLEXITY_TO_WIDTH_RATIO = 8
const LOC_TO_HEIGHT_RATIO = 24

/**
 * Преобразует coverage файла в цвет здания.
 *
 * @param coverage Покрытие файла тестами в процентах.
 * @returns Hex-цвет для материала здания.
 */
export function resolveCodeCityBuildingColor(coverage: number | undefined): string {
    if (coverage === undefined) {
        return "#facc15"
    }
    if (coverage >= 85) {
        return "#22c55e"
    }
    if (coverage >= 65) {
        return "#14b8a6"
    }
    if (coverage >= 45) {
        return "#fb923c"
    }
    return "#ef4444"
}

/**
 * Генерирует 3D-здания по файлам репозитория.
 *
 * @param files Набор файлов CodeCity.
 * @returns Нормализованные меши зданий.
 */
export function createCodeCityBuildingMeshes(
    files: ReadonlyArray<ICodeCity3DSceneFileDescriptor>,
): ReadonlyArray<ICodeCityBuildingMesh> {
    const columns = Math.max(1, Math.ceil(Math.sqrt(files.length)))
    const rows = Math.max(1, Math.ceil(files.length / columns))

    return files.map((file, index): ICodeCityBuildingMesh => {
        const rowIndex = Math.floor(index / columns)
        const columnIndex = index % columns
        const horizontalOffset = (columns - 1) / 2
        const verticalOffset = (rows - 1) / 2
        const fileComplexity = file.complexity ?? 0
        const fileLoc = file.loc ?? 0
        const x = (columnIndex - horizontalOffset) * BASE_GRID_SPACING
        const z = (rowIndex - verticalOffset) * BASE_GRID_SPACING
        const width = Math.max(
            MIN_BUILDING_WIDTH,
            Math.min(MAX_BUILDING_WIDTH, fileComplexity / COMPLEXITY_TO_WIDTH_RATIO),
        )
        const depth = BUILDING_DEPTH
        const height = Math.max(MIN_BUILDING_HEIGHT, fileLoc / LOC_TO_HEIGHT_RATIO)

        return {
            color: resolveCodeCityBuildingColor(file.coverage),
            depth,
            height,
            id: file.id,
            width,
            x,
            z,
        }
    })
}

/**
 * 3D renderer для CodeCity: базовая сцена + здания файлов.
 *
 * @param props Данные файлов для генерации города.
 * @returns Canvas с orbit/pan/zoom контролами.
 */
export function CodeCity3DSceneRenderer(props: ICodeCity3DSceneRendererProps): ReactElement {
    const buildings = useMemo(
        (): ReadonlyArray<ICodeCityBuildingMesh> => createCodeCityBuildingMeshes(props.files),
        [props.files],
    )

    return (
        <Canvas camera={{ fov: 45, position: [24, 22, 26] }} dpr={[1, 1.5]} shadows={false}>
            <color args={["#020617"]} attach="background" />
            <ambientLight intensity={0.55} />
            <directionalLight intensity={0.9} position={[18, 30, 12]} />
            <gridHelper args={[100, 80, "#334155", "#1e293b"]} />
            {buildings.map((building): ReactElement => (
                <mesh
                    key={building.id}
                    position={[building.x, building.height / 2, building.z]}
                >
                    <boxGeometry args={[building.width, building.height, building.depth]} />
                    <meshStandardMaterial color={building.color} metalness={0.1} roughness={0.6} />
                </mesh>
            ))}
            <OrbitControls
                enablePan={true}
                enableRotate={true}
                enableZoom={true}
                makeDefault={true}
            />
        </Canvas>
    )
}
