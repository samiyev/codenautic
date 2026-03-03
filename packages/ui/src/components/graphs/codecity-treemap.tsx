import { type ReactElement, useMemo } from "react"

import { Card, CardBody, CardHeader } from "@/components/ui"
import { ResponsiveContainer, Treemap } from "recharts"

const DEFAULT_HEIGHT = "420px"
const DEFAULT_EMPTY_LABEL = "No file data for CodeCity treemap yet."

/** Файл для источника CodeCity 2D treemap. */
export interface ICodeCityTreemapFileDescriptor {
    /** Идентификатор файла. */
    readonly id: string
    /** Путь к файлу. */
    readonly path: string
    /** LOC/строки кода. */
    readonly loc?: number
    /** Комплексная метрика сложности (fallback при отсутствии LOC). */
    readonly complexity?: number
    /** Общее количество строк (fallback при отсутствии LOC/complexity). */
    readonly size?: number
}

interface ICodeCityTreemapFileNode {
    /** Идентификатор файла. */
    readonly id: string
    /** Отображаемое имя файла. */
    readonly name: string
    /** Полный путь к файлу. */
    readonly path: string
    /** Значение веса для treemap. */
    readonly value: number
}

interface ICodeCityTreemapPackageNode {
    /** Название пакета (группы файлов). */
    readonly name: string
    /** Общий вес пакета. */
    readonly value: number
    /** Файлы в пакете. */
    readonly children: ReadonlyArray<ICodeCityTreemapFileNode>
}

/** Агрегированные данные для визуализации treemap. */
export interface ICodeCityTreemapData {
    /** Узлы верхнего уровня (пакеты). */
    readonly packages: ReadonlyArray<ICodeCityTreemapPackageNode>
    /** Сумма LOC в дереве. */
    readonly totalLoc: number
    /** Общее число файлов в виджете. */
    readonly totalFiles: number
}

/** Пропсы компонента treemap. */
export interface ICodeCityTreemapProps {
    /** Файлы для постройки 2D treemap. */
    readonly files: ReadonlyArray<ICodeCityTreemapFileDescriptor>
    /** Высота контейнера. */
    readonly height?: string
    /** Заголовок. */
    readonly title?: string
    /** Текст пустого состояния. */
    readonly emptyStateLabel?: string
}

function normalizePath(rawPath: string): string {
    return rawPath.trim().replaceAll("\\", "/")
}

function resolvePackageName(filePath: string): string {
    const normalizedPath = normalizePath(filePath)
    const separatorIndex = normalizedPath.lastIndexOf("/")
    if (separatorIndex <= 0) {
        return "root"
    }

    return normalizedPath.slice(0, separatorIndex)
}

function resolveFileName(filePath: string): string {
    const normalizedPath = normalizePath(filePath)
    const separatorIndex = normalizedPath.lastIndexOf("/")
    if (separatorIndex === -1) {
        return normalizedPath
    }

    return normalizedPath.slice(separatorIndex + 1)
}

function resolveFileLoc(file: ICodeCityTreemapFileDescriptor): number {
    const candidate = file.loc ?? file.size ?? file.complexity
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 1) {
        return Math.floor(candidate)
    }

    return 1
}

/**
 * Формирует иерархические данные для treemap (package -> files) с метрикой размера LOC.
 *
 * @param files Пакет метрик файлов.
 * @returns Нормализованные данные и метрики.
 */
export function buildCodeCityTreemapData(
    files: ReadonlyArray<ICodeCityTreemapFileDescriptor>,
): ICodeCityTreemapData {
    const packageMap = new Map<string, ICodeCityTreemapFileNode[]>()
    const fileIds = new Set<string>()
    let totalFiles = 0
    let totalLoc = 0

    for (const file of files) {
        const normalizedPath = normalizePath(file.path)
        if (normalizedPath.length === 0 || file.id.length === 0) {
            continue
        }
        if (fileIds.has(file.id) === true) {
            continue
        }
        fileIds.add(file.id)

        const packageName = resolvePackageName(normalizedPath)
        const fileName = resolveFileName(normalizedPath)
        const fileLoc = resolveFileLoc(file)
        const packageFiles = packageMap.get(packageName)
        const fileNode: ICodeCityTreemapFileNode = {
            id: file.id,
            name: fileName,
            path: normalizedPath,
            value: fileLoc,
        }

        if (packageFiles === undefined) {
            packageMap.set(packageName, [fileNode])
            continue
        }

        packageFiles.push(fileNode)
    }

    const packages: ICodeCityTreemapPackageNode[] = Array.from(packageMap.entries())
        .map(([name, children]): ICodeCityTreemapPackageNode => {
            const sortedChildren = [...children].sort((left, right): number => {
                return right.value - left.value
            })
            const packageValue = sortedChildren.reduce(
                (total, fileNode): number => total + fileNode.value,
                0,
            )

            return {
                children: sortedChildren,
                name,
                value: packageValue,
            }
        })
        .filter((entry): boolean => entry.children.length > 0)
        .sort((left, right): number => right.value - left.value)

    for (const packageItem of packages) {
        totalFiles += packageItem.children.length
        totalLoc += packageItem.value
    }

    return {
        packages,
        totalFiles,
        totalLoc,
    }
}

/**
 * Рендерит 2D treemap на базе Recharts.
 *
 * @param props Пропсы визуализации.
 */
export function CodeCityTreemap(props: ICodeCityTreemapProps): ReactElement {
    const title = props.title ?? "CodeCity treemap"
    const emptyStateLabel = props.emptyStateLabel ?? DEFAULT_EMPTY_LABEL
    const height = props.height ?? DEFAULT_HEIGHT
    const treemapData = useMemo(
        () => buildCodeCityTreemapData(props.files),
        [props.files],
    )

    const summaryText = `Packages: ${treemapData.packages.length}, Files: ${treemapData.totalFiles}, LOC: ${treemapData.totalLoc}`

    if (treemapData.packages.length === 0) {
        return (
            <Card aria-label={title}>
                <CardHeader>
                    <h3 className="text-lg font-semibold">{title}</h3>
                </CardHeader>
                <CardBody>
                    <p>{emptyStateLabel}</p>
                </CardBody>
            </Card>
        )
    }

    return (
        <Card aria-label={title}>
            <CardHeader>
                <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-foreground-500">{summaryText}</p>
                </div>
            </CardHeader>
            <CardBody>
                <div aria-label="Code city treemap" style={{ height, width: "100%" }}>
                    <ResponsiveContainer height="100%" width="100%">
                        <Treemap
                            data={treemapData.packages}
                            dataKey="value"
                            nameKey="name"
                            stroke="hsl(var(--nextui-colors-defaultBorder))"
                            fill="hsl(var(--nextui-colors-primary))"
                        />
                    </ResponsiveContainer>
                </div>
            </CardBody>
        </Card>
    )
}

