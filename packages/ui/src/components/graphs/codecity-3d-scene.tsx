import { Suspense, lazy, useMemo, useState, type ReactElement } from "react"

interface ICodeCity3DSceneFileDescriptor {
    /** Уникальный ID файла. */
    readonly id: string
    /** Путь файла. */
    readonly path: string
    /** Объём строк кода. */
    readonly loc?: number
    /** Оценка сложности. */
    readonly complexity?: number
    /** Покрытие файла тестами. */
    readonly coverage?: number
}

/**
 * Тип воздействия файла в CCR impact-наборах.
 */
export type TCodeCityImpactType = "changed" | "impacted" | "ripple"

/**
 * Дескриптор файла с impact-контекстом для 3D подсветки.
 */
export interface ICodeCity3DSceneImpactedFileDescriptor {
    /** Идентификатор файла (совпадает с id в files). */
    readonly fileId: string
    /** Тип воздействия для визуализации. */
    readonly impactType: TCodeCityImpactType
}

/**
 * Пресеты позиции камеры для 3D CodeCity.
 */
export type TCodeCityCameraPreset = "bird-eye" | "street-level" | "focus-on-building"

/**
 * Параметры 3D CodeCity preview.
 */
export interface ICodeCity3DSceneProps {
    /** Заголовок для ARIA/описания сцены. */
    readonly title: string
    /** Набор файлов для генерации зданий. */
    readonly files: ReadonlyArray<ICodeCity3DSceneFileDescriptor>
    /** Набор impact-файлов для подсветки зданий. */
    readonly impactedFiles?: ReadonlyArray<ICodeCity3DSceneImpactedFileDescriptor>
    /** Высота canvas-контейнера. */
    readonly height?: number
}

const LazyCodeCity3DSceneRenderer = lazy(
    async (): Promise<{
        default: (props: {
            readonly cameraPreset: TCodeCityCameraPreset
            readonly files: ReadonlyArray<ICodeCity3DSceneFileDescriptor>
            readonly impactedFiles: ReadonlyArray<ICodeCity3DSceneImpactedFileDescriptor>
            readonly selectedFileId?: string
            readonly onBuildingHover?: (fileId: string | undefined) => void
            readonly onBuildingSelect?: (fileId: string | undefined) => void
        }) => ReactElement
    }> => {
        const module = await import("./codecity-3d-scene-renderer")
        return {
            default: module.CodeCity3DSceneRenderer,
        }
    },
)

const CAMERA_PRESET_OPTIONS: ReadonlyArray<{
    readonly id: TCodeCityCameraPreset
    readonly label: string
}> = [
    {
        id: "bird-eye",
        label: "Bird eye",
    },
    {
        id: "street-level",
        label: "Street level",
    },
    {
        id: "focus-on-building",
        label: "Focus building",
    },
] as const

/**
 * Обёртка 3D сцены: проверяет WebGL и лениво подгружает renderer.
 *
 * @param props Конфигурация 3D preview.
 * @returns 3D canvas или fallback при отсутствии WebGL.
 */
export function CodeCity3DScene(props: ICodeCity3DSceneProps): ReactElement {
    const [cameraPreset, setCameraPreset] = useState<TCodeCityCameraPreset>("bird-eye")
    const [hoveredFileId, setHoveredFileId] = useState<string | undefined>(undefined)
    const [selectedFileId, setSelectedFileId] = useState<string | undefined>(undefined)
    const isWebGlSupported = useMemo((): boolean => {
        if (typeof document === "undefined") {
            return false
        }

        const canvas = document.createElement("canvas")
        const webGlContext = canvas.getContext("webgl")
        const webGl2Context = canvas.getContext("webgl2")
        return webGlContext !== null || webGl2Context !== null
    }, [])
    const fileById = useMemo((): ReadonlyMap<string, ICodeCity3DSceneFileDescriptor> => {
        return new Map(props.files.map((file): readonly [string, ICodeCity3DSceneFileDescriptor] => [file.id, file]))
    }, [props.files])
    const hoveredFile = hoveredFileId !== undefined ? fileById.get(hoveredFileId) : undefined
    const selectedFile = selectedFileId !== undefined ? fileById.get(selectedFileId) : undefined

    if (isWebGlSupported === false) {
        return (
            <div
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700"
                role="status"
            >
                WebGL unavailable on this device. Switch to 2D treemap mode.
            </div>
        )
    }

    return (
        <section
            aria-label={props.title}
            className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-950/95"
            style={{ height: `${String(props.height ?? 420)}px` }}
        >
            <div className="absolute left-3 top-3 z-10 flex gap-2">
                {CAMERA_PRESET_OPTIONS.map((option): ReactElement => (
                    <button
                        aria-label={`Camera preset ${option.label}`}
                        aria-pressed={cameraPreset === option.id}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                            cameraPreset === option.id
                                ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                                : "border-slate-500 bg-slate-900/70 text-slate-300 hover:border-slate-300 hover:text-slate-100"
                        }`}
                        key={option.id}
                        onClick={(): void => {
                            setCameraPreset(option.id)
                        }}
                        type="button"
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            {hoveredFile !== undefined ? (
                <aside className="absolute bottom-3 left-3 z-10 rounded-md border border-cyan-400/50 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg">
                    <p className="font-semibold text-cyan-200">Hover preview</p>
                    <p className="mt-1">{hoveredFile.path}</p>
                    <p className="mt-1 text-slate-300">
                        LOC {String(hoveredFile.loc ?? 0)} · Complexity{" "}
                        {String(hoveredFile.complexity ?? 0)} · Coverage{" "}
                        {String(hoveredFile.coverage ?? 0)}%
                    </p>
                </aside>
            ) : null}
            {selectedFile !== undefined ? (
                <aside className="absolute right-3 top-14 z-10 w-72 rounded-lg border border-slate-400/40 bg-slate-900/95 p-3 text-sm text-slate-100 shadow-xl">
                    <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-cyan-200">File details</p>
                        <button
                            aria-label="Close file details panel"
                            className="rounded border border-slate-500 px-2 py-0.5 text-xs text-slate-200 hover:border-slate-200"
                            onClick={(): void => {
                                setSelectedFileId(undefined)
                            }}
                            type="button"
                        >
                            Close
                        </button>
                    </div>
                    <p className="mt-2 break-all text-xs text-slate-300">{selectedFile.path}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                            <dt className="text-slate-400">LOC</dt>
                            <dd className="mt-1 font-semibold text-slate-100">
                                {String(selectedFile.loc ?? 0)}
                            </dd>
                        </div>
                        <div className="rounded border border-slate-700 bg-slate-900/70 p-2">
                            <dt className="text-slate-400">Complexity</dt>
                            <dd className="mt-1 font-semibold text-slate-100">
                                {String(selectedFile.complexity ?? 0)}
                            </dd>
                        </div>
                        <div className="col-span-2 rounded border border-slate-700 bg-slate-900/70 p-2">
                            <dt className="text-slate-400">Coverage</dt>
                            <dd className="mt-1 font-semibold text-slate-100">
                                {String(selectedFile.coverage ?? 0)}%
                            </dd>
                        </div>
                    </dl>
                </aside>
            ) : null}
            <Suspense
                fallback={
                    <div className="flex h-full items-center justify-center text-sm text-slate-300">
                        Loading 3D scene...
                    </div>
                }
            >
                <LazyCodeCity3DSceneRenderer
                    cameraPreset={cameraPreset}
                    files={props.files}
                    impactedFiles={props.impactedFiles ?? []}
                    onBuildingHover={setHoveredFileId}
                    onBuildingSelect={setSelectedFileId}
                    selectedFileId={selectedFileId}
                />
            </Suspense>
        </section>
    )
}

export type { ICodeCity3DSceneFileDescriptor }
