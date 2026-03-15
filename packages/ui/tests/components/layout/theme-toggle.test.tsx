import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { renderWithProviders } from "../../utils/render"

const mockSetMode = vi.fn()
const mockSetPreset = vi.fn()

const mockState = {
    mode: "system" as "dark" | "light" | "system",
    preset: "sunrise" as const,
    resolvedMode: "light" as "dark" | "light",
}

vi.mock("@/lib/theme/use-theme", () => ({
    useTheme: (): {
        mode: "dark" | "light" | "system"
        preset: string
        presets: ReadonlyArray<{ readonly id: string; readonly label: string }>
        resolvedMode: "dark" | "light"
        setMode: (m: string) => void
        setPreset: (p: string) => void
    } => ({
        mode: mockState.mode,
        preset: mockState.preset,
        presets: [
            { id: "moonstone", label: "Moonstone" },
            { id: "cobalt", label: "Cobalt" },
            { id: "forest", label: "Forest" },
            { id: "sunrise", label: "Sunrise" },
            { id: "graphite", label: "Graphite" },
            { id: "aqua", label: "Aqua" },
        ],
        resolvedMode: mockState.resolvedMode,
        setMode: mockSetMode,
        setPreset: mockSetPreset,
    }),
}))

describe("ThemeToggle", (): void => {
    beforeEach((): void => {
        mockState.mode = "system"
        mockState.preset = "sunrise"
        mockState.resolvedMode = "light"
        mockSetMode.mockClear()
        mockSetPreset.mockClear()
    })

    it("when rendered, then shows dark, system and light mode buttons", (): void => {
        renderWithProviders(<ThemeToggle />)

        expect(screen.getByLabelText("Use dark theme")).not.toBeNull()
        expect(screen.getByLabelText("Use system theme")).not.toBeNull()
        expect(screen.getByLabelText("Use light theme")).not.toBeNull()
    })

    it("when rendered, then shows radiogroup for theme mode", (): void => {
        renderWithProviders(<ThemeToggle />)

        const radiogroup = screen.getByRole("radiogroup")
        expect(radiogroup).not.toBeNull()
    })

    it("when a mode button is clicked, then calls setMode", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<ThemeToggle />)

        const lightButton = screen.getByLabelText("Use light theme")
        await user.click(lightButton)

        expect(mockSetMode).toHaveBeenCalledWith("light")
    })

    it("when className is provided, then applies it to wrapper", (): void => {
        const { container } = renderWithProviders(<ThemeToggle className="custom-toggle" />)

        const wrapper = container.querySelector(".custom-toggle")
        expect(wrapper).not.toBeNull()
    })

    it("when rendered, then shows preset label text", (): void => {
        renderWithProviders(<ThemeToggle />)

        expect(screen.getByText(/Preset:/)).not.toBeNull()
    })

    it("when rendered, then shows sr-only resolved mode announcement", (): void => {
        renderWithProviders(<ThemeToggle />)

        const srAnnouncement = screen.getByText(/Active theme resolved mode is/)
        expect(srAnnouncement).not.toBeNull()
        expect(srAnnouncement.className).toContain("sr-only")
    })
})
