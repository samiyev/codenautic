import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { TourCustomizer, type ITourCustomizerProps } from "@/components/graphs/tour-customizer"
import { renderWithProviders } from "../utils/render"

const TEST_STEPS: ITourCustomizerProps["steps"] = [
    {
        description: "Configure repository and metric.",
        id: "controls",
        title: "Configure dashboard scope",
    },
    {
        description: "Inspect 3D topology and hotspots.",
        id: "city-3d",
        title: "Inspect 3D city",
    },
]

function TourCustomizerHarness(): ReactElement {
    const [steps, setSteps] = useState<ITourCustomizerProps["steps"]>(TEST_STEPS)

    return (
        <div>
            <TourCustomizer isAdmin={true} onStepsChange={setSteps} steps={steps} />
            <p>order:{steps.map((step): string => step.id).join(",")}</p>
            <p>
                city-description:
                {steps.find((step): boolean => step.id === "city-3d")?.description ?? "missing"}
            </p>
        </div>
    )
}

describe("TourCustomizer", (): void => {
    it("показывает admin-gated состояние, когда прав нет", (): void => {
        renderWithProviders(<TourCustomizer isAdmin={false} onStepsChange={(): void => {}} steps={TEST_STEPS} />)

        expect(screen.getByText("Tour customizer")).not.toBeNull()
        expect(
            screen.getByText("Admin access is required to create and reorder custom tour steps."),
        ).not.toBeNull()
    })

    it("добавляет custom stop и редактирует описание шага", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<TourCustomizerHarness />)

        await user.type(screen.getByRole("textbox", { name: "Tour stop title" }), "Deep dive")
        await user.type(
            screen.getByRole("textbox", { name: "Tour stop description" }),
            "Review subsystem handoff points",
        )
        await user.click(screen.getByRole("button", { name: "Add custom tour stop" }))

        expect(screen.getByText("order:controls,city-3d,custom-stop-3")).not.toBeNull()

        const cityDescriptionField = screen.getByRole("textbox", {
            name: "Tour step description city-3d",
        })
        await user.clear(cityDescriptionField)
        await user.type(cityDescriptionField, "Updated city stop details")

        expect(screen.getByText("city-description:Updated city stop details")).not.toBeNull()
    })

    it("поддерживает drag-and-drop reorder шагов", (): void => {
        renderWithProviders(<TourCustomizerHarness />)

        const sourceItem = screen.getByText("Step ID: controls").closest("li")
        const targetItem = screen.getByText("Step ID: city-3d").closest("li")

        if (sourceItem === null || targetItem === null) {
            throw new Error("Failed to resolve draggable tour list items")
        }

        fireEvent.dragStart(sourceItem)
        fireEvent.dragOver(targetItem)
        fireEvent.drop(targetItem)

        expect(screen.getByText("order:city-3d,controls")).not.toBeNull()
    })
})
