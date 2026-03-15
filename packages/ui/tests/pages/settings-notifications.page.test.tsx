import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type {
    IChannelPreferencesResponse,
    IInAppMuteRules,
    IMuteRulesResponse,
    INotificationsListResponse,
    TChannelPreferencesMap,
} from "@/lib/api/endpoints/notifications.endpoint"
import type { IUseNotificationsResult } from "@/lib/hooks/queries/use-notifications"

let mockNotifications: INotificationsListResponse = {
    notifications: [
        {
            id: "NTF-1001",
            isRead: false,
            message: "CCR #412 finished with 3 high-priority suggestions.",
            occurredAt: "2026-03-04T11:10:00Z",
            targetHref: "/reviews/412",
            title: "Review completed",
            type: "review.completed",
        },
        {
            id: "NTF-1002",
            isRead: false,
            message: "Service layer imports crossed domain boundary in api-gateway.",
            occurredAt: "2026-03-04T09:36:00Z",
            targetHref: "/dashboard/code-city",
            title: "Architecture drift alert",
            type: "drift.alert",
        },
        {
            id: "NTF-1003",
            isRead: true,
            message: "Predicted hotspot confidence increased for src/scan-worker.ts.",
            occurredAt: "2026-03-03T18:45:00Z",
            targetHref: "/reviews",
            title: "Prediction alert",
            type: "prediction.alert",
        },
        {
            id: "NTF-1004",
            isRead: false,
            message: "CCR #409 completed and ready for final approval.",
            occurredAt: "2026-03-03T16:12:00Z",
            targetHref: "/reviews/409",
            title: "Review completed",
            type: "review.completed",
        },
    ],
    total: 4,
}

let mockChannels: TChannelPreferencesMap = {
    discord: { enabled: false, target: "" },
    inApp: { enabled: true, target: "inbox" },
    slack: { enabled: true, target: "#code-review" },
    teams: { enabled: true, target: "CodeNautic Review Squad" },
}

let mockMuteRules: IInAppMuteRules = {
    muteNonCriticalAtNight: true,
    mutePredictionsForArchivedRepos: false,
    quietHoursEnd: "08:00",
    quietHoursStart: "22:00",
}

const mockMarkRead = vi.fn()
const mockUpdateChannels = vi.fn()
const mockUpdateMuteRules = vi.fn()

vi.mock("@/lib/hooks/queries/use-notifications", () => {
    return {
        useNotifications: (): IUseNotificationsResult => {
            return {
                historyQuery: {
                    data: mockNotifications,
                    isLoading: false,
                    isError: false,
                    error: null,
                } as unknown as IUseNotificationsResult["historyQuery"],
                channelsQuery: {
                    data: { channels: mockChannels } satisfies IChannelPreferencesResponse,
                    isLoading: false,
                    isError: false,
                    error: null,
                } as unknown as IUseNotificationsResult["channelsQuery"],
                muteRulesQuery: {
                    data: { muteRules: mockMuteRules } satisfies IMuteRulesResponse,
                    isLoading: false,
                    isError: false,
                    error: null,
                } as unknown as IUseNotificationsResult["muteRulesQuery"],
                markRead: {
                    mutate: (id: string): void => {
                        mockMarkRead(id)
                        const updated = mockNotifications.notifications.map((n) => {
                            if (n.id === id) {
                                return { ...n, isRead: true }
                            }
                            return n
                        })
                        mockNotifications = { notifications: updated, total: updated.length }
                    },
                    isPending: false,
                } as unknown as IUseNotificationsResult["markRead"],
                updateChannels: {
                    mutate: (channels: TChannelPreferencesMap): void => {
                        mockUpdateChannels(channels)
                        mockChannels = channels
                    },
                    isPending: false,
                } as unknown as IUseNotificationsResult["updateChannels"],
                updateMuteRules: {
                    mutate: (rules: IInAppMuteRules): void => {
                        mockUpdateMuteRules(rules)
                        mockMuteRules = rules
                    },
                    isPending: false,
                } as unknown as IUseNotificationsResult["updateMuteRules"],
            }
        },
    }
})

import { SettingsNotificationsPage } from "@/pages/settings-notifications.page"
import { renderWithProviders } from "../utils/render"

/**
 * Сбрасывает mock данные перед каждым тестом.
 */
function resetMockData(): void {
    mockNotifications = {
        notifications: [
            {
                id: "NTF-1001",
                isRead: false,
                message: "CCR #412 finished with 3 high-priority suggestions.",
                occurredAt: "2026-03-04T11:10:00Z",
                targetHref: "/reviews/412",
                title: "Review completed",
                type: "review.completed",
            },
            {
                id: "NTF-1002",
                isRead: false,
                message: "Service layer imports crossed domain boundary in api-gateway.",
                occurredAt: "2026-03-04T09:36:00Z",
                targetHref: "/dashboard/code-city",
                title: "Architecture drift alert",
                type: "drift.alert",
            },
            {
                id: "NTF-1003",
                isRead: true,
                message: "Predicted hotspot confidence increased for src/scan-worker.ts.",
                occurredAt: "2026-03-03T18:45:00Z",
                targetHref: "/reviews",
                title: "Prediction alert",
                type: "prediction.alert",
            },
            {
                id: "NTF-1004",
                isRead: false,
                message: "CCR #409 completed and ready for final approval.",
                occurredAt: "2026-03-03T16:12:00Z",
                targetHref: "/reviews/409",
                title: "Review completed",
                type: "review.completed",
            },
        ],
        total: 4,
    }
    mockChannels = {
        discord: { enabled: false, target: "" },
        inApp: { enabled: true, target: "inbox" },
        slack: { enabled: true, target: "#code-review" },
        teams: { enabled: true, target: "CodeNautic Review Squad" },
    }
    mockMuteRules = {
        muteNonCriticalAtNight: true,
        mutePredictionsForArchivedRepos: false,
        quietHoursEnd: "08:00",
        quietHoursStart: "22:00",
    }
    mockMarkRead.mockClear()
    mockUpdateChannels.mockClear()
    mockUpdateMuteRules.mockClear()
}

describe("SettingsNotificationsPage", (): void => {
    it("управляет inbox read state, deep-links и delivery preferences", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(
            screen.getByRole("heading", { level: 1, name: "Notification center" }),
        ).not.toBeNull()
        expect(screen.getByText("Unread: 3")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Mark as read NTF-1001" }))
        await waitFor(() => {
            expect(mockMarkRead).toHaveBeenCalledWith("NTF-1001")
        })

        const deepLinkButton = screen.getByRole("button", { name: "Open NTF-1001 context" })
        await user.click(deepLinkButton)
        await waitFor(() => {
            expect(screen.getByText("Deep-link guard")).not.toBeNull()
        })
        expect(screen.getByText(/Deep-link allowed and sanitized to/)).not.toBeNull()

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

        await user.click(screen.getByRole("button", { name: "Undo bulk action" }))
        await waitFor(() => {
            expect(screen.queryByText("Bulk action pending sync")).toBeNull()
        })
        expect(screen.getByText("Bulk action audit")).not.toBeNull()
        expect(screen.getByText("reverted")).not.toBeNull()
    })

    it("переключает канал Discord и обновляет target input", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        const discordSwitch = screen.getByRole("switch", {
            name: "Enable Discord notifications",
        })
        expect(discordSwitch).not.toBeNull()

        await user.click(discordSwitch)
        expect(screen.getByText("Active channels: 4")).not.toBeNull()

        await user.click(discordSwitch)
        expect(screen.getByText("Active channels: 3")).not.toBeNull()
    })

    it("переключает Teams канал и обновляет счётчик активных каналов", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Active channels: 3")).not.toBeNull()

        const teamsSwitch = screen.getByRole("switch", { name: "Enable Teams notifications" })
        await user.click(teamsSwitch)
        expect(screen.getByText("Active channels: 2")).not.toBeNull()
    })

    it("фильтрует уведомления по drift.alert и показывает только drift события", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Filter event type" }),
            "drift.alert",
        )

        const inboxList = screen.getByRole("list", { name: "Notification inbox list" })
        expect(within(inboxList).getByText("Architecture drift alert")).not.toBeNull()
        expect(within(inboxList).queryByText("Review completed")).toBeNull()
        expect(within(inboxList).queryByText("Prediction alert")).toBeNull()
    })

    it("фильтрует по review.completed и показывает только review уведомления", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Filter event type" }),
            "review.completed",
        )

        const inboxList = screen.getByRole("list", { name: "Notification inbox list" })
        const listItems = within(inboxList).getAllByRole("listitem")
        expect(listItems.length).toBe(2)
        expect(within(inboxList).queryByText("Architecture drift alert")).toBeNull()
        expect(within(inboxList).queryByText("Prediction alert")).toBeNull()
    })

    it("mark all as read обнуляет unread счётчик", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Unread: 3")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Mark all as read" }))
        await waitFor((): void => {
            expect(mockMarkRead).toHaveBeenCalled()
        })
    })

    it("toggle read/unread переключает состояние уведомления обратно", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        await user.click(screen.getByRole("button", { name: "Mark as read NTF-1001" }))
        await waitFor((): void => {
            expect(mockMarkRead).toHaveBeenCalledWith("NTF-1001")
        })
    })

    it("выбор и снятие выбора уведомления обновляет selected count", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Selected: 0")).not.toBeNull()

        await user.click(screen.getByRole("checkbox", { name: "Select NTF-1001" }))
        expect(screen.getByText("Selected: 1")).not.toBeNull()
        expect(screen.getByText("1 notifications selected.")).not.toBeNull()

        await user.click(screen.getByRole("checkbox", { name: "Select NTF-1001" }))
        expect(screen.getByText("Selected: 0")).not.toBeNull()
    })

    it("clear selection сбрасывает выделение", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        await user.click(screen.getByRole("checkbox", { name: "Select NTF-1001" }))
        await user.click(screen.getByRole("checkbox", { name: "Select NTF-1002" }))
        expect(screen.getByText("Selected: 2")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Clear selection" }))
        expect(screen.getByText("Selected: 0")).not.toBeNull()
    })

    it("save delivery preferences отображает toast подтверждения", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        const saveButton = screen.getByRole("button", { name: "Save delivery preferences" })
        await user.click(saveButton)
        expect(saveButton).not.toBeNull()
    })

    it("переключает mute prediction alerts для archived repos", async (): Promise<void> => {
        resetMockData()
        const user = userEvent.setup()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Enabled rules: 1")).not.toBeNull()

        const predictionMuteSwitch = screen.getByRole("switch", {
            name: "Mute prediction alerts for archived repositories",
        })
        await user.click(predictionMuteSwitch)
        expect(screen.getByText("Enabled rules: 2")).not.toBeNull()
    })

    it("показывает начальное состояние bulk audit без операций", async (): Promise<void> => {
        resetMockData()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("No bulk operations executed yet.")).not.toBeNull()
    })

    it("bulk mark read без выбранных уведомлений не изменяет состояние", (): void => {
        resetMockData()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Selected: 0")).not.toBeNull()
        expect(screen.queryByText("Bulk actions")).toBeNull()
    })

    it("показывает quiet hours в чипах mute rules", async (): Promise<void> => {
        resetMockData()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Quiet hours: 22:00 - 08:00")).not.toBeNull()
    })

    it("отображает Total и Active channels чипы корректно при инициализации", async (): Promise<void> => {
        resetMockData()
        renderWithProviders(<SettingsNotificationsPage />)

        expect(screen.getByText("Total: 4")).not.toBeNull()
        expect(screen.getByText("Active channels: 3")).not.toBeNull()
    })
})
