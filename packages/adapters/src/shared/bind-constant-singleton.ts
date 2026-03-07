import {Container, type InjectionToken} from "@codenautic/core"

/**
 * Registers a constant value as singleton dependency in container.
 *
 * @template T Dependency type.
 * @param container Target container.
 * @param token Dependency token.
 * @param value Dependency instance.
 */
export function bindConstantSingleton<T>(
    container: Container,
    token: InjectionToken<T>,
    value: T,
): void {
    container.bindSingleton(token, () => {
        return value
    })
}
