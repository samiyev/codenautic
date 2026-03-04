import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsNotificationsPage } from "@/pages/settings-notifications.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsNotificationsPage", (): void => {
    it("управляет inbox read state, deep-links и delivery preferences", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Notification center" })).not.toBeNull()
        expect(screen.getByText("Unread: 3")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Mark as read NTF-1001" }))
        await waitFor(() => {
            expect(screen.getByText("Unread: 2")).not.toBeNull()
            expect(screen.getByRole("button", { name: "Mark as unread NTF-1001" })).not.toBeNull()
        })

        const deepLinkButton = screen.getByRole("button", { name: "Open NTF-1001 context" })
        await user.click(deepLinkButton)
        await waitFor(() => {
            expect(screen.getByText("Deep-link guard")).not.toBeNull()
        })
        expect(screen.getByText(/Deep-link allowed and sanitized/)).not.toBeNull()

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Filter event type" }),
            "prediction.alert",
        )
        const inboxList = screen.getByRole("list", { name: "Notification inbox list" })
        expect(within(inboxList).queryByText("Review completed")).toBeNull()
        expect(
            within(inboxList).queryByRole("button", { name: "Open NTF-1001 context" }),
        ).toBeNull()
        expect(
            within(inboxList).getByRole("button", { name: "Open NTF-1003 context" }),
        ).not.toBeNull()

        const slackSwitch = screen.getByRole("switch", { name: "Enable Slack notifications" })
        await user.click(slackSwitch)
        expect(screen.getByText("Active channels: 2")).not.toBeNull()

        const muteSwitch = screen.getByRole("switch", { name: "Mute non-critical alerts in-app" })
        await user.click(muteSwitch)
        expect(screen.getByText("Enabled rules: 0")).not.toBeNull()

        await user.selectOptions(screen.getByRole("combobox", { name: "Filter event type" }), "all")
        await user.click(screen.getByRole("checkbox", { name: "Select NTF-1002" }))
        await user.click(screen.getByRole("checkbox", { name: "Select NTF-1004" }))
        await user.click(screen.getByRole("button", { name: "Mark selected as read" }))
        await waitFor(() => {
            expect(screen.getByText("Bulk action pending sync")).not.toBeNull()
        })
        expect(screen.getByText("Unread: 0")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Undo bulk action" }))
        await waitFor(() => {
            expect(screen.getByText("Unread: 2")).not.toBeNull()
        })
        expect(screen.getByText("Bulk action audit")).not.toBeNull()
        expect(screen.getByText("reverted")).not.toBeNull()
    })
})
