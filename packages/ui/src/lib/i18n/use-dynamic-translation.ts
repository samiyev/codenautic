import { useCallback } from "react"
import { useTranslation } from "react-i18next"

/**
 * Known i18n namespace identifiers.
 */
type TI18nNamespace =
    | "auth"
    | "code-city"
    | "common"
    | "dashboard"
    | "navigation"
    | "onboarding"
    | "reports"
    | "reviews"
    | "settings"
    | "system"

/**
 * Dynamic translation function type.
 * Accepts any string key (not just compile-time literal keys).
 */
type TDynamicTranslator = (
    key: string,
    options?: Readonly<Record<string, string | number>>,
) => string

/**
 * Return type of {@link useDynamicTranslation}.
 */
interface IUseDynamicTranslationReturn {
    /**
     * Translate a dynamic key (variable, computed string, mapped key).
     * Use this instead of `t as unknown as (key: string) => string`.
     */
    readonly td: TDynamicTranslator
}

/**
 * Hook for translating dynamic i18n keys (variables, mapped keys, computed strings).
 *
 * The standard `t()` from react-i18next requires literal string types for
 * compile-time key validation. When keys are variables (e.g., from a map or loop),
 * TypeScript rejects the call. This hook provides a typed `td()` function
 * that accepts any string key, centralizing the single unavoidable type assertion.
 *
 * @param namespaces - Optional i18n namespace(s) to load.
 * @returns Object with `td` — a dynamic translation function.
 *
 * @example
 * ```typescript
 * const { td } = useDynamicTranslation(["dashboard"])
 * const label = td(`dashboard:metric.${metricKey}`)
 * ```
 */
export function useDynamicTranslation(
    namespaces?: ReadonlyArray<TI18nNamespace>,
): IUseDynamicTranslationReturn {
    const { t } = useTranslation(namespaces as TI18nNamespace[])

    const td: TDynamicTranslator = useCallback(
        (
            key: string,
            options?: Readonly<Record<string, string | number>>,
        ): string =>
            (t as unknown as TDynamicTranslator)(key, options),
        [t],
    )

    return { td }
}
