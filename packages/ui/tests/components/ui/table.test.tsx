import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { renderWithProviders } from "../../utils/render"

describe("Table", (): void => {
    it("when rendered with rows, then displays table structure", (): void => {
        renderWithProviders(
            <Table>
                <TableHeader>
                    <TableColumn>Name</TableColumn>
                    <TableColumn>Status</TableColumn>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Alice</TableCell>
                        <TableCell>Active</TableCell>
                    </TableRow>
                </TableBody>
            </Table>,
        )

        expect(screen.getByText("Name")).not.toBeNull()
        expect(screen.getByText("Status")).not.toBeNull()
        expect(screen.getByText("Alice")).not.toBeNull()
        expect(screen.getByText("Active")).not.toBeNull()
    })

    it("when TableBody has no rows, then renders emptyContent", (): void => {
        renderWithProviders(
            <Table>
                <TableHeader>
                    <TableColumn>Name</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No data available" />
            </Table>,
        )

        expect(screen.getByText("No data available")).not.toBeNull()
    })

    it("when custom className is provided, then applies it to table", (): void => {
        const { container } = renderWithProviders(
            <Table className="custom-table">
                <TableBody>
                    <TableRow>
                        <TableCell>Cell</TableCell>
                    </TableRow>
                </TableBody>
            </Table>,
        )

        const table = container.querySelector("table")
        expect(table?.className).toContain("custom-table")
    })

    it("when multiple rows are provided, then renders all rows", (): void => {
        renderWithProviders(
            <Table>
                <TableBody>
                    <TableRow>
                        <TableCell>Row 1</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Row 2</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Row 3</TableCell>
                    </TableRow>
                </TableBody>
            </Table>,
        )

        expect(screen.getByText("Row 1")).not.toBeNull()
        expect(screen.getByText("Row 2")).not.toBeNull()
        expect(screen.getByText("Row 3")).not.toBeNull()
    })

    it("when TableHeader is rendered, then wraps columns in thead > tr", (): void => {
        const { container } = renderWithProviders(
            <Table>
                <TableHeader>
                    <TableColumn>Col</TableColumn>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Data</TableCell>
                    </TableRow>
                </TableBody>
            </Table>,
        )

        const thead = container.querySelector("thead")
        expect(thead).not.toBeNull()
        expect(thead?.querySelector("tr")).not.toBeNull()
    })
})
