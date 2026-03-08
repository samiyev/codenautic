import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectOverviewPanel } from "@/components/graphs/project-overview-panel"
import { renderWithProviders } from "../utils/render"

describe("ProjectOverviewPanel", (): void => {
    it("рендерит архитектурный summary, tech stack и entry points", (): void => {
        renderWithProviders(
            <ProjectOverviewPanel
                files={[
                    { path: "src/main.ts" },
                    { path: "src/app/router.tsx" },
                    { path: "src/components/button.tsx" },
                    { path: "tests/app.test.tsx" },
                    { path: "README.md" },
                ]}
                repositoryId="platform-team/api-gateway"
                repositoryLabel="API gateway"
            />,
        )

        expect(screen.getByText("Project overview")).not.toBeNull()
        expect(screen.getByText("API gateway (platform-team/api-gateway)")).not.toBeNull()
        expect(screen.getByText("Architecture summary")).not.toBeNull()
        expect(screen.getByText("Tech stack")).not.toBeNull()
        expect(screen.getByText("Entry points")).not.toBeNull()
        expect(screen.getByText("src/main.ts")).not.toBeNull()
    })

    it("показывает fallback, если entry points отсутствуют", (): void => {
        renderWithProviders(
            <ProjectOverviewPanel
                files={[{ path: "src/domain/entity.ts" }, { path: "src/domain/value-object.ts" }]}
                repositoryId="backend-core/payment-worker"
                repositoryLabel="Payment worker"
            />,
        )

        expect(screen.getByText("No entry points detected in current scan.")).not.toBeNull()
    })
})
