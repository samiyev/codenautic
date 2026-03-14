import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ActivityTimelineItem } from "@/components/dashboard/activity-timeline-item"
import { renderWithProviders } from "../../utils/render"

describe("ActivityTimelineItem", (): void => {
    it("when rendered, then shows time, title and description", (): void => {
        renderWithProviders(
            <ul>
                <ActivityTimelineItem
                    time="14:30"
                    title="Review completed"
                    description="PR #42 was reviewed"
                />
            </ul>,
        )

        expect(screen.getByText("14:30")).not.toBeNull()
        expect(screen.getByText("Review completed")).not.toBeNull()
        expect(screen.getByText("PR #42 was reviewed")).not.toBeNull()
    })

    it("when details are provided, then renders expandable details section", (): void => {
        renderWithProviders(
            <ul>
                <ActivityTimelineItem
                    time="09:00"
                    title="Deploy started"
                    description="Production deploy"
                    details="Deployed version 1.2.3 to all regions"
                />
            </ul>,
        )

        expect(screen.getByText("View details")).not.toBeNull()
        expect(screen.getByText("Deployed version 1.2.3 to all regions")).not.toBeNull()
    })

    it("when details are not provided, then does not render details section", (): void => {
        renderWithProviders(
            <ul>
                <ActivityTimelineItem
                    time="10:00"
                    title="Scan complete"
                    description="Repository indexed"
                />
            </ul>,
        )

        expect(screen.queryByText("View details")).toBeNull()
    })

    it("when rendered, then wraps content in a list item", (): void => {
        const { container } = renderWithProviders(
            <ul>
                <ActivityTimelineItem time="12:00" title="Event" description="Something happened" />
            </ul>,
        )

        const listItem = container.querySelector("li")
        expect(listItem).not.toBeNull()
    })
})
