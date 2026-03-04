import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsAuditLogsPage } from "@/pages/settings-audit-logs.page"
import { renderWithProviders } from "../utils/render"

const TEST_AUDIT_LOGS = [
    {
        action: "member.invited" as const,
        actor: "Ari Karimov",
        details: "Invited anya@acme.dev to Platform Enablement team.",
        id: "audit-test-1",
        occurredAt: "2026-03-04T09:13:00Z",
        target: "team:platform-enablement",
    },
    {
        action: "role.changed" as const,
        actor: "Mila Davletova",
        details: "Changed role for oliver@acme.dev from viewer to developer.",
        id: "audit-test-2",
        occurredAt: "2026-03-03T10:13:00Z",
        target: "team:platform-ux",
    },
    {
        action: "policy.updated" as const,
        actor: "Ari Karimov",
        details: "Updated review policy for critical repositories.",
        id: "audit-test-3",
        occurredAt: "2026-02-20T10:13:00Z",
        target: "policy:code-review",
    },
]

describe("SettingsAuditLogsPage", (): void => {
    it("фильтрует по actor/action/date и экспортирует отфильтрованный набор", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsAuditLogsPage logs={TEST_AUDIT_LOGS} />)

        expect(screen.getByRole("heading", { level: 1, name: "Audit logs" })).not.toBeNull()
        expect(screen.getByText("Showing 3 of 3 entries.")).not.toBeNull()

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Filter by actor" }),
            "Ari Karimov",
        )
        expect(screen.getByText("Showing 2 of 3 entries.")).not.toBeNull()

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Filter by action" }),
            "member.invited",
        )
        expect(screen.getByText("Showing 1 of 3 entries.")).not.toBeNull()
        expect(screen.getByText("Invited anya@acme.dev to Platform Enablement team.")).not.toBeNull()

        fireEvent.change(screen.getByLabelText("Date from"), {
            target: { value: "2026-03-05" },
        })
        expect(screen.getByText("Showing 0 of 3 entries.")).not.toBeNull()

        fireEvent.change(screen.getByLabelText("Date from"), {
            target: { value: "2026-03-01" },
        })
        fireEvent.change(screen.getByLabelText("Date to"), {
            target: { value: "2026-03-04" },
        })
        expect(screen.getByText("Showing 1 of 3 entries.")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Export CSV" }))
        expect(screen.getByText("Exported 1 rows to CSV.")).not.toBeNull()
    })
})
