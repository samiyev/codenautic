import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    OwnershipTransitionWidget,
    type IOwnershipTransitionEvent,
} from "@/components/team-analytics/ownership-transition-widget"
import { renderWithProviders } from "../utils/render"

const TEST_EVENTS: ReadonlyArray<IOwnershipTransitionEvent> = [
    {
        changedAt: "2026-01-08T00:00:00.000Z",
        fileId: "src/api/auth.ts",
        fromOwnerName: "Neo",
        handoffSeverity: "critical",
        id: "handoff-1",
        reason: "Primary owner moved to platform migration stream.",
        scopeLabel: "src/api/auth.ts",
        scopeType: "file",
        toOwnerId: "trinity",
        toOwnerName: "Trinity",
    },
    {
        changedAt: "2026-02-02T00:00:00.000Z",
        fileId: "src/api/repository.ts",
        fromOwnerName: "Trinity",
        handoffSeverity: "smooth",
        id: "handoff-2",
        reason: "Planned rotation after pair-review onboarding.",
        scopeLabel: "src/api",
        scopeType: "module",
        toOwnerId: "morpheus",
        toOwnerName: "Morpheus",
    },
]

describe("OwnershipTransitionWidget", (): void => {
    it("рендерит timeline ownership transitions и handoff индикаторы", (): void => {
        renderWithProviders(<OwnershipTransitionWidget events={TEST_EVENTS} />)

        expect(screen.getByText("Ownership transition widget")).not.toBeNull()
        expect(screen.getByLabelText("Ownership transitions")).not.toBeNull()
        expect(screen.getByText("src/api/auth.ts")).not.toBeNull()
        expect(screen.getByText("Neo → Trinity")).not.toBeNull()
        expect(screen.getByText("Critical handoff")).not.toBeNull()
        expect(screen.getByText("Smooth handoff")).not.toBeNull()
    })

    it("вызывает onSelectEvent при выборе transition", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectEvent = vi.fn()
        renderWithProviders(
            <OwnershipTransitionWidget events={TEST_EVENTS} onSelectEvent={onSelectEvent} />,
        )

        await user.click(
            screen.getByRole("button", { name: "Inspect ownership transition src/api/auth.ts" }),
        )

        expect(onSelectEvent).toHaveBeenCalledTimes(1)
        expect(onSelectEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/api/auth.ts",
                handoffSeverity: "critical",
                toOwnerId: "trinity",
            }),
        )
    })
})
