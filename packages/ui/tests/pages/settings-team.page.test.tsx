import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SettingsTeamPage } from "@/pages/settings-team.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsTeamPage", (): void => {
    beforeEach((): void => {
        window.localStorage.setItem("codenautic:rbac:role", "admin")
    })

    afterEach((): void => {
        window.localStorage.removeItem("codenautic:rbac:role")
    })

    it("позволяет создать команду, добавить участника, назначить репозиторий и сменить роль", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsTeamPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Team management" })).not.toBeNull()

        await user.type(screen.getByRole("textbox", { name: "Team name" }), "Platform Enablement")
        await user.type(
            screen.getByRole("textbox", { name: "Description" }),
            "Owns shared delivery standards.",
        )
        await user.click(screen.getByRole("button", { name: "Create team" }))

        expect(screen.getByRole("button", { name: /Platform Enablement/ })).not.toBeNull()
        expect(screen.getByText("Active team: Platform Enablement")).not.toBeNull()

        await user.type(screen.getByRole("textbox", { name: "Invite member by email" }), "anya@acme.dev")
        await user.selectOptions(screen.getByRole("combobox", { name: "Invite role" }), "developer")
        await user.click(screen.getByRole("button", { name: "Add member" }))

        expect(screen.getByText("anya@acme.dev")).not.toBeNull()

        const mobileRepositoryCheckbox = screen.getByRole("checkbox", { name: "mobile-app" })
        await user.click(mobileRepositoryCheckbox)
        expect((mobileRepositoryCheckbox as HTMLInputElement).checked).toBe(true)

        const memberRoleSelect = screen.getByRole("combobox", {
            name: "Role for member anya@acme.dev",
        })
        await user.selectOptions(memberRoleSelect, "lead")
        expect((memberRoleSelect as HTMLSelectElement).value).toBe("lead")
    })

    it("показывает disable/hidden состояния действий для viewer роли", (): void => {
        window.localStorage.setItem("codenautic:rbac:role", "viewer")

        renderWithProviders(<SettingsTeamPage />)

        expect(screen.queryByRole("button", { name: "Create team" })).toBeNull()
        expect(screen.getByText(/Create team policy: Viewer has read-only access/)).not.toBeNull()
        expect(screen.getByRole("button", { name: "Add member" })).not.toBeNull()
        expect(screen.getByText(/Invite policy: Viewer cannot invite members/)).not.toBeNull()
        expect(screen.queryByRole("combobox", { name: /Role for member/ })).toBeNull()

        const repositoryCheckbox = screen.getByRole("checkbox", { name: "api-gateway" })
        expect((repositoryCheckbox as HTMLInputElement).disabled).toBe(true)
    })
})
