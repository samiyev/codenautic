import { screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { InfiniteScrollContainer } from "@/components/infrastructure/infinite-scroll-container"
import { renderWithProviders } from "../utils/render"

const intersectionObserverState = {
    isIntersecting: false,
}

vi.mock("usehooks-ts", () => {
    return {
        useIntersectionObserver: (): {
            readonly ref: (node?: Element | null) => void
            readonly isIntersecting: boolean
            readonly entry: IntersectionObserverEntry | undefined
        } => {
            return {
                ref: (): void => {},
                isIntersecting: intersectionObserverState.isIntersecting,
                entry: undefined,
            }
        },
    }
})

describe("InfiniteScrollContainer", (): void => {
    beforeEach((): void => {
        intersectionObserverState.isIntersecting = false
    })

    it("вызывает onLoadMore когда sentinel пересекает viewport", async (): Promise<void> => {
        intersectionObserverState.isIntersecting = true
        const onLoadMore = vi.fn()

        renderWithProviders(
            <InfiniteScrollContainer hasMore={true} isLoading={false} onLoadMore={onLoadMore}>
                <div>rows</div>
            </InfiniteScrollContainer>,
        )

        await waitFor((): void => {
            expect(onLoadMore).toHaveBeenCalled()
        })
    })

    it("показывает loading text в режиме загрузки", (): void => {
        renderWithProviders(
            <InfiniteScrollContainer
                hasMore={true}
                isLoading={true}
                loadingText="Loading next page..."
                onLoadMore={(): void => {}}
            >
                <div>rows</div>
            </InfiniteScrollContainer>,
        )

        expect(screen.getByText("Loading next page...")).not.toBeNull()
    })
})
