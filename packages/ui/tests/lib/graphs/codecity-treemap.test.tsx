import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
    CodeCityTreemap,
    buildCodeCityTreemapData,
    type ICodeCityTreemapFileDescriptor,
} from "@/components/graphs/codecity-treemap"

interface ITreeNode {
    readonly children?: ReadonlyArray<unknown>
    readonly name?: string
}

const mockTreemap = vi.fn((props: { readonly data: ReadonlyArray<ITreeNode> }): JSX.Element => {
    return (
        <div>
            <span data-testid="treemap-packages">{props.data.length}</span>
        </div>
    )
})

const mockResponsiveContainer = vi.fn(
    ({
        children,
    }: {
        readonly children: JSX.Element | null
    }): JSX.Element => {
        return <div>{children}</div>
    },
)

vi.mock("recharts", () => ({
    ResponsiveContainer: mockResponsiveContainer,
    Treemap: mockTreemap,
}))

describe("codecity treemap graph", (): void => {
    const sampleFiles: ReadonlyArray<ICodeCityTreemapFileDescriptor> = [
        { id: "src/api/auth.ts", loc: 80, path: "src/api/auth.ts" },
        { id: "src/api/session.ts", complexity: 30, path: "src/api/session.ts" },
        { id: "src/ui/index.ts", size: 40, path: "src/ui/index.ts" },
    ]

    it("формирует иерархию package->files и считает LOC", (): void => {
        const graph = buildCodeCityTreemapData(sampleFiles)

        expect(graph.totalFiles).toBe(3)
        expect(graph.totalLoc).toBe(150)
        expect(graph.packages).toHaveLength(2)

        const apiPackage = graph.packages.find((entry) => entry.name === "src/api")
        expect(apiPackage).not.toBeUndefined()
        expect(apiPackage?.children).toHaveLength(2)
        expect(apiPackage?.value).toBe(110)
    })

    it("формирует метрики цвета для выбранной шкалы", (): void => {
        const colorByComplexity = buildCodeCityTreemapData(sampleFiles, "complexity")
        const colorByCoverage = buildCodeCityTreemapData(
            sampleFiles.map(
                (file): ICodeCityTreemapFileDescriptor => ({
                    ...file,
                    coverage: file.id === "src/ui/index.ts" ? 10 : 95,
                }),
            ),
            "coverage",
        )

        expect(colorByComplexity.metric).toBe("complexity")
        expect(colorByCoverage.metric).toBe("coverage")
        expect(colorByComplexity.packages[0]?.children[0]?.metricValue).toBe(30)
        expect(colorByCoverage.packages[0]?.children[0]?.metricValue).toBe(95)
        expect(colorByComplexity.packages[0]?.children[0]?.color).not.toBe(
            colorByCoverage.packages[0]?.children[0]?.color,
        )
    })

    it("рендерит treemap и отображает summary", (): void => {
        mockTreemap.mockClear()
        mockResponsiveContainer.mockClear()

        render(
            <CodeCityTreemap
                files={sampleFiles}
                title="CodeCity treemap"
            />,
        )

        expect(screen.getByText("CodeCity treemap")).not.toBeNull()
        expect(screen.getByText("Packages: 2, Files: 3, LOC: 150")).not.toBeNull()
        expect(screen.getByTestId("treemap-packages")).not.toBeNull()
        expect(screen.getByText("Color metric: Complexity")).not.toBeNull()
        expect(screen.getByText("Low")).not.toBeNull()
        expect(screen.getByText("High")).not.toBeNull()
        expect(mockTreemap).toHaveBeenCalledTimes(1)
    })

    it("передаёт цвет в данные treemap и позволяет менять метрику", (): void => {
        mockTreemap.mockClear()

        render(<CodeCityTreemap files={sampleFiles} title="CodeCity treemap" />)

        expect(screen.getByTestId("treemap-packages")).not.toBeNull()
        const firstCallPackages = mockTreemap.mock.calls[0]?.[0]?.data as
            | ReadonlyArray<{ readonly children: ReadonlyArray<{ readonly color: string }> }>
            | undefined
        expect(firstCallPackages?.[0]?.children[0]?.color).not.toBe(undefined)

        const selector = screen.getByLabelText("Metric")
        fireEvent.change(selector, { target: { value: "churn" } })

        expect(screen.getByText("Color metric: Churn")).not.toBeNull()
        const secondCallPackages = mockTreemap.mock.calls[1]?.[0]?.data as
            | ReadonlyArray<{ readonly children: ReadonlyArray<{ readonly color: string }> }>
            | undefined
        expect(secondCallPackages?.[0]?.children[0]?.color).not.toBe(
            firstCallPackages?.[0]?.children[0]?.color,
        )
    })

    it("показывает пустое состояние для пустого набора файлов", (): void => {
        mockTreemap.mockClear()

        render(<CodeCityTreemap title="Empty treemap" files={[]} />)

        expect(screen.getByText("Empty treemap")).not.toBeNull()
        expect(screen.getByText("No file data for CodeCity treemap yet.")).not.toBeNull()
        expect(screen.queryByTestId("treemap-packages")).toBeNull()
        expect(mockTreemap).toHaveBeenCalledTimes(0)
    })
})
