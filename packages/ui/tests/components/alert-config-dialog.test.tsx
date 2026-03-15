import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    AlertConfigDialog,
    type IAlertConfigDialogModule,
} from "@/components/codecity/alert-config-dialog"
import { renderWithProviders } from "../utils/render"

const TEST_MODULES: ReadonlyArray<IAlertConfigDialogModule> = [
    {
        enabledByDefault: true,
        label: "api",
        moduleId: "api",
    },
    {
        enabledByDefault: false,
        label: "worker",
        moduleId: "worker",
    },
]

describe("AlertConfigDialog", (): void => {
    it("рендерит пороги, каналы, частоту и модули", (): void => {
        renderWithProviders(<AlertConfigDialog modules={TEST_MODULES} />)

        expect(screen.getByText("Alert config dialog")).not.toBeNull()
        expect(screen.getByLabelText("Alert confidence threshold")).not.toBeNull()
        expect(screen.getByLabelText("Alert issue increase threshold")).not.toBeNull()
        expect(screen.getByLabelText("Alert channels")).not.toBeNull()
        expect(screen.getByLabelText("Alert frequency")).not.toBeNull()
        expect(screen.getByLabelText("Alert modules")).not.toBeNull()
    })

    it("сохраняет конфигурацию через onSave", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        renderWithProviders(<AlertConfigDialog modules={TEST_MODULES} onSave={onSave} />)

        const confidenceInput = screen.getByLabelText("Alert confidence threshold")
        await user.clear(confidenceInput)
        await user.type(confidenceInput, "82")

        await user.click(screen.getByRole("checkbox", { name: "slack" }))
        await user.click(screen.getByRole("checkbox", { name: "webhook" }))
        await user.selectOptions(screen.getByLabelText("Alert frequency"), "weekly")
        await user.click(screen.getByRole("checkbox", { name: "worker" }))
        await user.click(
            screen.getByRole("button", { name: "Save prediction alert configuration" }),
        )

        expect(onSave).toHaveBeenCalledTimes(1)
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                channels: ["email", "webhook"],
                confidenceThreshold: 82,
                frequency: "weekly",
                moduleIds: ["api", "worker"],
            }),
        )
    })
})
