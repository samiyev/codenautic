import { useEffect, useState } from "react"

import {
    PROVIDER_DEGRADATION_EVENT,
    isProviderDegradationDetail,
    type IProviderDegradationEventDetail,
} from "@/lib/providers/degradation-mode"

/**
 * Результат хука отслеживания деградации провайдеров.
 */
export interface IProviderDegradationResult {
    /** Детали деградации провайдера (undefined если operational). */
    readonly providerDegradation: IProviderDegradationEventDetail | undefined
}

/**
 * Слушает события деградации провайдеров (LLM, Git и т.д.)
 * и предоставляет текущий статус для отображения alert-баннера.
 *
 * @returns Текущее состояние деградации провайдера.
 */
export function useProviderDegradation(): IProviderDegradationResult {
    const [providerDegradation, setProviderDegradation] = useState<
        IProviderDegradationEventDetail | undefined
    >(undefined)

    useEffect((): (() => void) | void => {
        const handleProviderDegradation = (event: Event): void => {
            const customEvent = event as CustomEvent<unknown>
            const detail = customEvent.detail
            if (isProviderDegradationDetail(detail) !== true) {
                return
            }

            if (detail.level === "operational") {
                setProviderDegradation(undefined)
                return
            }

            setProviderDegradation(detail)
        }

        window.addEventListener(
            PROVIDER_DEGRADATION_EVENT,
            handleProviderDegradation as EventListener,
        )

        return (): void => {
            window.removeEventListener(
                PROVIDER_DEGRADATION_EVENT,
                handleProviderDegradation as EventListener,
            )
        }
    }, [])

    return { providerDegradation }
}
