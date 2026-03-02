import {UniqueId} from "../value-objects/unique-id.value-object"

/**
 * Base class for entities with identity semantics.
 *
 * @template TProps Entity state type.
 */
export abstract class Entity<TProps> {
    protected readonly props: TProps
    private readonly _id: UniqueId

    /**
     * Creates entity.
     *
     * @param id Immutable entity identifier. Auto-generated when omitted.
     * @param props Mutable internal state container.
     */
    public constructor(id: UniqueId | undefined, props: TProps) {
        this._id = id ?? UniqueId.create()
        freezeShallowInputProps(props)
        this.props = cloneShallowProps(props)
    }

    /**
     * Entity identifier.
     *
     * @returns Immutable identifier.
     */
    public get id(): UniqueId {
        return this._id
    }

    /**
     * Identity-based equality.
     *
     * @param other Another entity.
     * @returns True when identifiers match.
     */
    public equals(other: Entity<unknown> | null | undefined): boolean {
        return this.isEqual(other)
    }

    /**
     * Identity-based equality with explicit null/undefined/type guards.
     *
     * @param other Another entity instance.
     * @returns True when entities have the same runtime type and identifier.
     */
    public isEqual(other: Entity<unknown> | null | undefined): boolean {
        if (other === undefined || other === null) {
            return false
        }

        if (other.constructor !== this.constructor) {
            return false
        }

        return this._id.equals(other.id)
    }
}

/**
 * Freezes only first-level input props object.
 *
 * @param props Entity props.
 */
function freezeShallowInputProps<TProps>(props: TProps): void {
    if (typeof props === "object" && props !== null) {
        Object.freeze(props)
    }
}

/**
 * Creates shallow mutable clone for internal state transitions.
 *
 * @param props Entity props.
 * @returns Shallow cloned value for objects and arrays, same value for primitives.
 */
function cloneShallowProps<TProps>(props: TProps): TProps {
    if (typeof props !== "object" || props === null) {
        return props
    }

    if (Array.isArray(props)) {
        return [...props] as TProps
    }

    return {...(props as Record<string, unknown>)} as TProps
}
