import { type ReactElement, type ReactNode, useEffect } from "react"

import { useIntersectionObserver } from "usehooks-ts"

/**
 * Параметры контейнера бесконечного скролла.
 */
export interface IInfiniteScrollContainerProps {
    /** Корневой элемент списка (scroll container). */
    readonly rootRef?: React.RefObject<HTMLElement | null>
    /** Есть ли ещё страницы для загрузки. */
    readonly hasMore: boolean
    /** Идет ли загрузка следующей страницы. */
    readonly isLoading: boolean
    /** Коллбек для загрузки следующего чанка. */
    readonly onLoadMore: () => Promise<void> | void
    /** Содержимое скролл-контейнера. */
    readonly children: ReactNode
    /** Дополнительный текст загрузки. */
    readonly loadingText?: string
}

/**
 * Generic контейнер для lazy/infinite scroll.
 *
 * @param props Конфигурация.
 * @returns Секция с sentinel для детекта конца списка.
 */
export function InfiniteScrollContainer(props: IInfiniteScrollContainerProps): ReactElement {
    const { ref, isIntersecting } = useIntersectionObserver({
        root: props.rootRef?.current ?? null,
        threshold: 0,
    })

    useEffect((): void => {
        if (isIntersecting !== true || props.hasMore !== true || props.isLoading === true) {
            return
        }

        void props.onLoadMore()
    }, [isIntersecting, props.hasMore, props.isLoading, props.onLoadMore])

    return (
        <div>
            {props.children}
            <div ref={ref} aria-hidden="true" className="h-1" />
            <div
                aria-live="polite"
                className="mt-2 flex justify-center py-2 text-sm text-muted"
            >
                {props.isLoading === true ? (props.loadingText ?? "Загружаем...") : null}
            </div>
        </div>
    )
}
