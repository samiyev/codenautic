declare const TOKEN_TYPE: unique symbol

/**
 * Type-safe DI token.
 */
export type InjectionToken<T> = symbol & {
    readonly [TOKEN_TYPE]: T
}

/**
 * Creates a new type-safe DI token.
 *
 * @param description Human-readable token description.
 * @returns Typed injection token.
 */
export function createToken<T>(description: string): InjectionToken<T> {
    return Symbol(description) as InjectionToken<T>
}
