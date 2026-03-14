import { describe, expect, it } from "vitest"

import { LoadingState } from "@/components/states/loading-state"
import { renderWithProviders } from "../../utils/render"

describe("LoadingState", (): void => {
    it("when rendered with default props, then shows 3 skeleton rows", (): void => {
        const { container } = renderWithProviders(<LoadingState />)

        const wrapper = container.firstElementChild
        expect(wrapper).not.toBeNull()
        expect(wrapper?.children.length).toBe(3)
    })

    it("when rows is specified, then renders exact number of skeletons", (): void => {
        const { container } = renderWithProviders(<LoadingState rows={5} />)

        const wrapper = container.firstElementChild
        expect(wrapper?.children.length).toBe(5)
    })

    it("when rows is 1, then renders single skeleton", (): void => {
        const { container } = renderWithProviders(<LoadingState rows={1} />)

        const wrapper = container.firstElementChild
        expect(wrapper?.children.length).toBe(1)
    })

    it("when className is provided, then applies custom class to wrapper", (): void => {
        const { container } = renderWithProviders(<LoadingState className="custom-loading" />)

        const wrapper = container.firstElementChild
        expect(wrapper?.className).toContain("custom-loading")
    })
})
