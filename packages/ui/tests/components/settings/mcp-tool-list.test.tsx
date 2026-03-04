import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MCPToolList } from "@/components/settings/mcp-tool-list"
import { renderWithProviders } from "../../utils/render"

describe("MCPToolList", (): void => {
    it("рендерит список MCP tools и метрики", (): void => {
        renderWithProviders(
            <MCPToolList
                items={[
                    {
                        toolId: "figma.design-context",
                        calls: 142,
                        errorCount: 4,
                        avgLatencyMs: 268,
                    },
                    {
                        toolId: "review.diff-insights",
                        calls: 95,
                        errorCount: 6,
                        avgLatencyMs: 211,
                    },
                ]}
            />,
        )

        expect(screen.getAllByTestId("mcp-tool-row")).toHaveLength(2)
        expect(screen.getByText("figma.design-context")).not.toBeNull()
        expect(screen.getByText("268 ms")).not.toBeNull()
    })
})
