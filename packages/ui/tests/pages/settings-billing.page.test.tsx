import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { IUseBillingResult } from "@/lib/hooks/queries/use-billing"

vi.mock("@/lib/hooks/queries/use-billing", () => {
    return {
        useBilling: (): IUseBillingResult => {
            return {
                billingQuery: {
                    data: {
                        snapshot: { plan: "pro", status: "active" },
                        history: [
                            {
                                action: "plan_change",
                                actor: "System",
                                id: "BILL-2001",
                                occurredAt: "2026-03-03T16:12:00Z",
                                outcome: "Upgraded from starter to pro",
                            },
                            {
                                action: "status_change",
                                actor: "Neo Anderson",
                                id: "BILL-2002",
                                occurredAt: "2026-03-02T10:40:00Z",
                                outcome: "Set status to trial for workspace onboarding",
                            },
                        ],
                    },
                    isLoading: false,
                    isError: false,
                    error: null,
                } as unknown as IUseBillingResult["billingQuery"],
                historyQuery: {
                    data: [],
                    isLoading: false,
                    isError: false,
                    error: null,
                } as unknown as IUseBillingResult["historyQuery"],
                updatePlan: {
                    mutate: vi.fn(),
                    isPending: false,
                } as unknown as IUseBillingResult["updatePlan"],
            }
        },
    }
})

import { SettingsBillingPage } from "@/pages/settings-billing.page"
import { renderWithProviders } from "../utils/render"

afterEach((): void => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe("SettingsBillingPage", (): void => {
    it("управляет lifecycle state, paywall и entitlement lock/unlock", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsBillingPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Billing lifecycle" })).not.toBeNull()
        expect(screen.getByText("Current plan:")).not.toBeNull()

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Billing status" }),
            "past_due",
        )
        await user.click(screen.getByRole("button", { name: "Apply billing change" }))

        await waitFor(() => {
            expect(screen.getByText("Payment overdue")).not.toBeNull()
        })
        expect(screen.getAllByText("Locked").length).toBeGreaterThan(0)

        await user.click(screen.getByRole("button", { name: "Mark invoice as paid" }))
        await waitFor(() => {
            expect(screen.getByText("Billing status is healthy")).not.toBeNull()
        })
    })

    it("подтверждает downgrade и фиксирует outcome в истории", async (): Promise<void> => {
        const user = userEvent.setup()
        const confirmSpy = vi.fn((): boolean => true)
        vi.stubGlobal("confirm", confirmSpy)
        renderWithProviders(<SettingsBillingPage />)

        await user.selectOptions(screen.getByRole("combobox", { name: "Billing plan" }), "starter")
        await user.click(screen.getByRole("button", { name: "Apply billing change" }))

        expect(confirmSpy).toHaveBeenCalledTimes(1)
        expect(
            screen.getAllByText(/Applied starter \/ active successfully/).length,
        ).toBeGreaterThan(0)
    })
})
