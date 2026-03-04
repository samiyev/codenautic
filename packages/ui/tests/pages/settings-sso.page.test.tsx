import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsSsoPage } from "@/pages/settings-sso.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsSsoPage", (): void => {
    it("сохраняет SAML/OIDC конфиг и выполняет test SSO сценарий", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsSsoPage />)

        expect(screen.getByRole("heading", { level: 1, name: "SSO provider management" })).not.toBeNull()

        await user.clear(screen.getByRole("textbox", { name: "SAML Entity ID" }))
        await user.type(
            screen.getByRole("textbox", { name: "SAML Entity ID" }),
            "urn:codenautic:sp:enterprise",
        )
        await user.clear(screen.getByRole("textbox", { name: "SAML SSO URL" }))
        await user.type(
            screen.getByRole("textbox", { name: "SAML SSO URL" }),
            "https://idp.enterprise.dev/sso",
        )
        await user.click(screen.getByRole("button", { name: "Save SAML config" }))
        expect(screen.getByText("SAML configuration saved")).not.toBeNull()

        await user.clear(screen.getByLabelText("OIDC client secret"))
        await user.type(screen.getByLabelText("OIDC client secret"), "supersecret")
        await user.click(screen.getByRole("button", { name: "Save OIDC config" }))
        expect(screen.getByText("OIDC configuration saved")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Test SSO (SAML)" }))
        expect(screen.getByText("SSO test passed for saml.")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Test SSO (OIDC)" }))
        expect(screen.getByText("SSO test passed for oidc.")).not.toBeNull()
    })
})
