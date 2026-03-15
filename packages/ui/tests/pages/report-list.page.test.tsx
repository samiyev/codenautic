import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { IReport, IReportsListResponse } from "@/lib/api/endpoints/reports.endpoint"
import type { IUseReportsResult } from "@/lib/hooks/queries/use-reports"

const mockDeleteReport = vi.fn()

const SEED_REPORTS: ReadonlyArray<IReport> = [
    {
        id: "report-001",
        title: "Delivery Throughput Pulse",
        type: "delivery",
        format: "pdf",
        status: "completed",
        createdAt: "2026-03-10",
        sections: ["executive-summary", "risk-hotspots"],
    },
    {
        id: "report-002",
        title: "Architecture Weekly Snapshot",
        type: "architecture",
        format: "html",
        status: "completed",
        createdAt: "2026-03-08",
        sections: ["architecture-drift"],
    },
    {
        id: "report-003",
        title: "Quality Gate Review",
        type: "quality",
        format: "png",
        status: "failed",
        createdAt: "2026-03-04",
        sections: ["executive-summary"],
    },
    {
        id: "report-004",
        title: "Architecture Drift Mid-Sprint",
        type: "architecture",
        format: "pdf",
        status: "completed",
        createdAt: "2026-03-06",
        sections: ["architecture-drift", "risk-hotspots"],
    },
]

/**
 * Мутабельный стейт для удаления/регенерации отчётов.
 */
const reportState: { reports: IReport[] } = { reports: [...SEED_REPORTS] }

vi.mock("@/lib/hooks/queries/use-reports", async () => {
    const { useState } = await import("react")

    return {
        useReports: (): IUseReportsResult => {
            const [reports, setReports] = useState<IReport[]>(() => [...reportState.reports])

            return {
                reportsQuery: {
                    data: {
                        reports,
                        total: reports.length,
                    } satisfies IReportsListResponse,
                    isLoading: false,
                    isError: false,
                    error: null,
                } as unknown as IUseReportsResult["reportsQuery"],
                createReport: {
                    mutate: vi.fn(),
                    isPending: false,
                } as unknown as IUseReportsResult["createReport"],
                deleteReport: {
                    mutate: (
                        reportId: string,
                        options?: { readonly onSuccess?: () => void },
                    ): void => {
                        mockDeleteReport(reportId)
                        setReports(
                            (prev): IReport[] =>
                                prev.filter((r): boolean => r.id !== reportId),
                        )
                        if (options?.onSuccess !== undefined) {
                            options.onSuccess()
                        }
                    },
                    isPending: false,
                } as unknown as IUseReportsResult["deleteReport"],
            }
        },
        useReportData: vi.fn(),
    }
})

import { ReportListPage } from "@/pages/report-list.page"
import { renderWithProviders } from "../utils/render"

describe("ReportListPage", (): void => {
    beforeEach((): void => {
        reportState.reports = [...SEED_REPORTS]
        mockDeleteReport.mockClear()
    })

    it("показывает список generated reports, фильтры и delete/regenerate actions", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<ReportListPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Report list" })).not.toBeNull()
        expect(screen.getByLabelText("Generated reports list")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Open generator" })).not.toBeNull()
        expect(screen.getAllByRole("button", { name: "Open viewer" }).length).toBeGreaterThan(0)

        await user.selectOptions(screen.getByLabelText("Report type"), "architecture")
        expect(screen.getByText("Architecture Weekly Snapshot")).not.toBeNull()
        expect(screen.queryByText("Delivery Throughput Pulse")).toBeNull()

        await user.selectOptions(screen.getByLabelText("Report type"), "all")
        await user.click(screen.getByRole("button", { name: "Regenerate report-001" }))
        await waitFor(() => {
            expect(screen.getByText("Regeneration queued for report report-001.")).not.toBeNull()
        })
        const regeneratedRow = screen.getByLabelText("Report row report-001")
        expect(within(regeneratedRow).getByText("queued")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Delete report-003" }))
        await waitFor(() => {
            expect(screen.queryByLabelText("Report row report-003")).toBeNull()
        })

        await user.type(screen.getByLabelText("Date from"), "2026-03-06")
        expect(screen.getByText("Architecture Drift Mid-Sprint")).not.toBeNull()
    })
})
