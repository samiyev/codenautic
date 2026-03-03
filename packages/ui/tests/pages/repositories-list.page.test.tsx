import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { RepositoriesListPage } from "@/pages/repositories-list.page"
import { renderWithProviders } from "../utils/render"

const repositories = [
    {
        branch: "main",
        issueCount: 2,
        lastScanAt: "2026-01-01T10:40:00Z",
        name: "api-gateway",
        owner: "platform-team",
        status: "ready",
    },
    {
        branch: "main",
        issueCount: 0,
        lastScanAt: "2026-01-01T09:10:00Z",
        name: "ui-dashboard",
        owner: "frontend-team",
        status: "scanning",
    },
    {
        branch: "release",
        issueCount: 3,
        lastScanAt: "2026-01-01T07:50:00Z",
        name: "payment-worker",
        owner: "backend-core",
        status: "error",
    },
]

describe("repositories list page", (): void => {
    it("находит репозитории по поиску и фильтрует по статусу", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<RepositoriesListPage repositories={repositories} />)

        await user.type(screen.getByLabelText("Поиск репозитория"), "api")
        expect(screen.getByText("api-gateway")).not.toBeNull()
        expect(screen.queryByText("ui-dashboard")).toBeNull()

        await user.selectOptions(screen.getByLabelText("Фильтр по статусу"), "error")
        expect(screen.queryByText("api-gateway")).toBeNull()
        expect(screen.getByText("payment-worker")).not.toBeNull()
    })

    it("меняет порядок сортировки", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<RepositoriesListPage repositories={repositories} />)
        await user.selectOptions(screen.getByLabelText("Сортировка"), "lastScanAt")

        expect(screen.getAllByText("payment-worker").length).toBe(1)
    })
})
