import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CodeCityTreemap, buildCodeCityTreemapData } from "@/components/graphs/codecity-treemap"

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
    const sampleFiles = [
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
        expect(mockTreemap).toHaveBeenCalledTimes(1)
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
