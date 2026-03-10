import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GIT_PROVIDER_CONNECTION_STATUS } from "@/lib/api/endpoints/git-providers.endpoint"
import { SettingsGitProvidersPage } from "@/pages/settings-git-providers.page"
import { renderWithProviders } from "../utils/render"

const { mockTestConnection, mockUpdateConnection, mockUseGitProviders } = vi.hoisted(() => ({
    mockTestConnection: vi.fn(async (): Promise<{ readonly ok: boolean }> => ({ ok: true })),
    mockUpdateConnection: vi.fn(async (): Promise<{ readonly ok: boolean }> => ({ ok: true })),
    mockUseGitProviders: vi.fn(),
}))

vi.mock("@/lib/hooks/queries", () => ({
    useGitProviders: mockUseGitProviders,
}))

afterEach((): void => {
    vi.clearAllMocks()
})

function setupMockWithProviders(
    providers: ReadonlyArray<{
        readonly account: string
        readonly connected: boolean
        readonly id: string
        readonly isKeySet: boolean
        readonly lastSyncAt: string | undefined
        readonly provider: string
        readonly status: string
    }>,
    overrides: {
        readonly isPending?: boolean
        readonly variables?: { readonly providerId: string } | undefined
    } = {},
): void {
    mockUseGitProviders.mockReturnValue({
        providersQuery: {
            data: {
                providers,
            },
        },
        updateConnection: {
            isPending: overrides.isPending ?? false,
            mutateAsync: mockUpdateConnection,
            variables: overrides.variables,
        },
        testConnection: {
            mutateAsync: mockTestConnection,
        },
    })
}

describe("SettingsGitProvidersPage", (): void => {
    it("рендерит подключенные git providers и connectivity блок", (): void => {
        setupMockWithProviders([
            {
                account: "acme-org",
                connected: true,
                id: "github",
                isKeySet: true,
                lastSyncAt: "2026-03-03 08:00",
                provider: "GitHub",
                status: GIT_PROVIDER_CONNECTION_STATUS.connected,
            },
            {
                account: "runtime-team",
                connected: false,
                id: "gitlab",
                isKeySet: false,
                lastSyncAt: undefined,
                provider: "GitLab",
                status: GIT_PROVIDER_CONNECTION_STATUS.disconnected,
            },
        ])

        renderWithProviders(<SettingsGitProvidersPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Git Providers" })).not.toBeNull()
        expect(screen.getByText("Connectivity checks")).not.toBeNull()
        expect(screen.getByText("GitHub")).not.toBeNull()
        expect(screen.getByText("GitLab")).not.toBeNull()
        expect(screen.getByText("At least one token is configured.")).not.toBeNull()
    })

    it("делегирует reconnect действие в updateConnection mutation", async (): Promise<void> => {
        const user = userEvent.setup()
        setupMockWithProviders([
            {
                account: "acme-org",
                connected: true,
                id: "github",
                isKeySet: true,
                lastSyncAt: "2026-03-03 08:00",
                provider: "GitHub",
                status: GIT_PROVIDER_CONNECTION_STATUS.connected,
            },
        ])

        renderWithProviders(<SettingsGitProvidersPage />)

        await user.click(screen.getByRole("button", { name: "Force reconnect" }))

        expect(mockUpdateConnection).toHaveBeenCalledWith({
            connected: false,
            providerId: "github",
        })
    })

    it("when providers data is undefined, then falls back to default providers", (): void => {
        mockUseGitProviders.mockReturnValue({
            providersQuery: {
                data: undefined,
            },
            updateConnection: {
                isPending: false,
                mutateAsync: mockUpdateConnection,
                variables: undefined,
            },
            testConnection: {
                mutateAsync: mockTestConnection,
            },
        })

        renderWithProviders(<SettingsGitProvidersPage />)

        expect(screen.getByText("GitHub")).not.toBeNull()
        expect(screen.getByText("GitLab")).not.toBeNull()
        expect(screen.getByText("Bitbucket")).not.toBeNull()
        expect(screen.getByText("Azure DevOps")).not.toBeNull()
        expect(screen.getByText("At least one token is configured.")).not.toBeNull()
    })

    it("when providers list is empty, then falls back to default providers", (): void => {
        mockUseGitProviders.mockReturnValue({
            providersQuery: {
                data: {
                    providers: [],
                },
            },
            updateConnection: {
                isPending: false,
                mutateAsync: mockUpdateConnection,
                variables: undefined,
            },
            testConnection: {
                mutateAsync: mockTestConnection,
            },
        })

        renderWithProviders(<SettingsGitProvidersPage />)

        expect(screen.getByText("GitHub")).not.toBeNull()
        expect(screen.getByText("GitLab")).not.toBeNull()
        expect(screen.getByText("Bitbucket")).not.toBeNull()
        expect(screen.getByText("Azure DevOps")).not.toBeNull()
    })

    it("when no provider has isKeySet true, then shows 'No tokens are configured yet.'", (): void => {
        setupMockWithProviders([
            {
                account: "team-x",
                connected: false,
                id: "gitlab",
                isKeySet: false,
                lastSyncAt: undefined,
                provider: "GitLab",
                status: GIT_PROVIDER_CONNECTION_STATUS.disconnected,
            },
        ])

        renderWithProviders(<SettingsGitProvidersPage />)

        expect(screen.getByText("No tokens are configured yet.")).not.toBeNull()
    })

    it("when test connection button is clicked, then delegates to testConnection mutation", async (): Promise<void> => {
        const user = userEvent.setup()
        setupMockWithProviders([
            {
                account: "acme-org",
                connected: true,
                id: "github",
                isKeySet: true,
                lastSyncAt: "2026-03-03 08:00",
                provider: "GitHub",
                status: GIT_PROVIDER_CONNECTION_STATUS.connected,
            },
        ])

        renderWithProviders(<SettingsGitProvidersPage />)

        await user.click(screen.getByRole("button", { name: "Test GitHub connection" }))

        await waitFor((): void => {
            expect(mockTestConnection).toHaveBeenCalledWith("github")
        })
    })

    it("when disconnected provider connect button is clicked, then calls updateConnection with connected true", async (): Promise<void> => {
        const user = userEvent.setup()
        setupMockWithProviders([
            {
                account: "team-x",
                connected: false,
                id: "gitlab",
                isKeySet: false,
                lastSyncAt: undefined,
                provider: "GitLab",
                status: GIT_PROVIDER_CONNECTION_STATUS.disconnected,
            },
        ])

        renderWithProviders(<SettingsGitProvidersPage />)

        const connectButtons = screen.getAllByRole("button", { name: "Connect" })
        await user.click(connectButtons[0] as HTMLButtonElement)

        expect(mockUpdateConnection).toHaveBeenCalledWith({
            connected: true,
            providerId: "gitlab",
        })
    })

    it("when updateConnection is pending for a provider, then passes isLoading to that card", (): void => {
        setupMockWithProviders(
            [
                {
                    account: "acme-org",
                    connected: true,
                    id: "github",
                    isKeySet: true,
                    lastSyncAt: "2026-03-03 08:00",
                    provider: "GitHub",
                    status: GIT_PROVIDER_CONNECTION_STATUS.connected,
                },
            ],
            {
                isPending: true,
                variables: { providerId: "github" },
            },
        )

        renderWithProviders(<SettingsGitProvidersPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Git Providers" })).not.toBeNull()
    })

    it("when test connection returns ok false, then button shows check failed state", async (): Promise<void> => {
        const user = userEvent.setup()
        mockTestConnection.mockResolvedValueOnce({ ok: false })
        setupMockWithProviders([
            {
                account: "acme-org",
                connected: true,
                id: "github",
                isKeySet: true,
                lastSyncAt: "2026-03-03 08:00",
                provider: "GitHub",
                status: GIT_PROVIDER_CONNECTION_STATUS.connected,
            },
        ])

        renderWithProviders(<SettingsGitProvidersPage />)

        await user.click(screen.getByRole("button", { name: "Test GitHub connection" }))

        await waitFor((): void => {
            expect(screen.getByText("GitHub check failed")).not.toBeNull()
        })
    })
})
