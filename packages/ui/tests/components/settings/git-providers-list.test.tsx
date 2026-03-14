import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { GitProvidersList } from "@/components/settings/git-providers-list"
import { renderWithProviders } from "../../utils/render"

describe("GitProvidersList", (): void => {
    it("when providers array is empty, then renders empty section", (): void => {
        const { container } = renderWithProviders(<GitProvidersList providers={[]} />)

        const section = container.querySelector("section")
        expect(section).not.toBeNull()
        expect(section?.children.length).toBe(0)
    })

    it("when multiple providers given, then renders a card for each provider", (): void => {
        renderWithProviders(
            <GitProvidersList
                providers={[
                    { connected: true, onAction: vi.fn(), provider: "GitHub" },
                    { connected: false, onAction: vi.fn(), provider: "GitLab" },
                    { connected: false, onAction: vi.fn(), provider: "Azure DevOps" },
                ]}
            />,
        )

        expect(screen.getByText("GitHub")).not.toBeNull()
        expect(screen.getByText("GitLab")).not.toBeNull()
        expect(screen.getByText("Azure DevOps")).not.toBeNull()
    })

    it("when a provider is connected, then its card shows connected status", (): void => {
        renderWithProviders(
            <GitProvidersList
                providers={[
                    {
                        account: "dev@example.com",
                        connected: true,
                        onAction: vi.fn(),
                        provider: "GitHub",
                    },
                ]}
            />,
        )

        expect(screen.getByText("Connected")).not.toBeNull()
        expect(screen.getByText("Connected as dev@example.com")).not.toBeNull()
    })

    it("when a provider is disconnected, then its card shows disconnected status", (): void => {
        renderWithProviders(
            <GitProvidersList
                providers={[{ connected: false, onAction: vi.fn(), provider: "Bitbucket" }]}
            />,
        )

        expect(screen.getByText("Disconnected")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Connect" })).not.toBeNull()
    })

    it("when rendered with grid layout, then section has grid class", (): void => {
        const { container } = renderWithProviders(
            <GitProvidersList
                providers={[{ connected: true, onAction: vi.fn(), provider: "GitHub" }]}
            />,
        )

        const section = container.querySelector("section")
        expect(section?.className).toContain("grid")
    })
})
