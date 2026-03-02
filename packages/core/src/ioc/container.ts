import {type InjectionToken} from "./create-token"

/**
 * Factory function for resolving dependency instance.
 *
 * @template T Produced dependency type.
 */
export type DependencyFactory<T> = (container: Container) => T

/**
 * Dependency lifecycle kind.
 */
type BindingLifecycle = "TRANSIENT" | "SINGLETON"

interface IBinding<T> {
    readonly lifecycle: BindingLifecycle
    readonly factory: DependencyFactory<T>
    instance?: T
}

/**
 * Lightweight IoC container for workers and non-HTTP runtimes.
 */
export class Container {
    private readonly bindings: Map<InjectionToken<unknown>, IBinding<unknown>>

    /**
     * Creates empty container.
     */
    public constructor() {
        this.bindings = new Map()
    }

    /**
     * Registers transient binding. New instance is created on each resolve call.
     *
     * @template T Dependency type.
     * @param token Dependency token.
     * @param factory Dependency factory.
     */
    public bind<T>(token: InjectionToken<T>, factory: DependencyFactory<T>): void {
        this.bindings.set(token as InjectionToken<unknown>, {
            lifecycle: "TRANSIENT",
            factory: factory as DependencyFactory<unknown>,
        })
    }

    /**
     * Registers singleton binding. First resolved instance is cached and reused.
     *
     * @template T Dependency type.
     * @param token Dependency token.
     * @param factory Dependency factory.
     */
    public bindSingleton<T>(token: InjectionToken<T>, factory: DependencyFactory<T>): void {
        this.bindings.set(token as InjectionToken<unknown>, {
            lifecycle: "SINGLETON",
            factory: factory as DependencyFactory<unknown>,
        })
    }

    /**
     * Resolves dependency by token.
     *
     * @template T Dependency type.
     * @param token Dependency token.
     * @returns Resolved instance.
     * @throws Error When token is not registered.
     */
    public resolve<T>(token: InjectionToken<T>): T {
        const binding = this.bindings.get(token as InjectionToken<unknown>)
        if (binding === undefined) {
            throw new Error(`No binding found for token '${describeToken(token)}'`)
        }

        return this.resolveBinding(binding) as T
    }

    /**
     * Checks whether token has active binding.
     *
     * @template T Dependency type.
     * @param token Dependency token.
     * @returns True when token is registered.
     */
    public has<T>(token: InjectionToken<T>): boolean {
        return this.bindings.has(token as InjectionToken<unknown>)
    }

    /**
     * Removes token binding if present.
     *
     * @template T Dependency type.
     * @param token Dependency token.
     */
    public unbind<T>(token: InjectionToken<T>): void {
        this.bindings.delete(token as InjectionToken<unknown>)
    }

    /**
     * Resolves binding according to lifecycle rules.
     *
     * @param binding Container binding record.
     * @returns Resolved dependency instance.
     */
    private resolveBinding(binding: IBinding<unknown>): unknown {
        if (binding.lifecycle === "TRANSIENT") {
            return binding.factory(this)
        }

        if (binding.instance === undefined) {
            binding.instance = binding.factory(this)
        }

        return binding.instance
    }
}

/**
 * Formats token description for error messages.
 *
 * @template T Dependency type.
 * @param token Dependency token.
 * @returns Human-readable token name.
 */
function describeToken<T>(token: InjectionToken<T>): string {
    return token.description ?? "anonymous-token"
}
