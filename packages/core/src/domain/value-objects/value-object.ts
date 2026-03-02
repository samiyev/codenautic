/**
 * Base class for immutable value objects.
 *
 * @template TProps Value object props type.
 */
export abstract class ValueObject<TProps> {
    protected readonly props: TProps

    /**
     * Creates value object and validates input props.
     *
     * @param props Value object props.
     * @throws Error When validation fails in concrete implementation.
     */
    public constructor(props: TProps) {
        this.validate(props)
        this.props = freezeShallow(props)
    }

    /**
     * Validates concrete value object props.
     *
     * @param props Value object props.
     * @throws Error When props are invalid.
     */
    protected abstract validate(props: TProps): void

    /**
     * Value-based equality.
     *
     * @param other Another value object.
     * @returns True when values match.
     */
    public equals(other: ValueObject<unknown> | null | undefined): boolean {
        return this.isEqual(other)
    }

    /**
     * Value-based equality with explicit null/undefined/type guards.
     *
     * @param other Another value object.
     * @returns True when value object type and props are equal.
     */
    public isEqual(other: ValueObject<unknown> | null | undefined): boolean {
        if (other === undefined || other === null) {
            return false
        }

        if (other.constructor !== this.constructor) {
            return false
        }

        return deepEquals(this.props, other.props)
    }
}

/**
 * Freezes only top-level props object.
 *
 * @param props Value object props.
 * @returns Frozen props for object inputs or same value for primitives.
 */
function freezeShallow<TProps>(props: TProps): TProps {
    if (typeof props !== "object" || props === null) {
        return props
    }

    return Object.freeze(props) as TProps
}

/**
 * Deep equality for value object props.
 *
 * @param left Left value.
 * @param right Right value.
 * @returns True when structures are deeply equal.
 */
function deepEquals(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
        return true
    }

    if (left === null || right === null) {
        return false
    }

    if (isDate(left) && isDate(right)) {
        return datesEqual(left, right)
    }

    if (isUnknownArray(left) && isUnknownArray(right)) {
        return arraysEqual(left, right)
    }

    if (isRecord(left) && isRecord(right)) {
        return recordsEqual(left, right)
    }

    return false
}

/**
 * Checks whether value is Date object.
 *
 * @param value Candidate value.
 * @returns True when value is Date.
 */
function isDate(value: unknown): value is Date {
    return value instanceof Date
}

/**
 * Checks whether value is unknown array.
 *
 * @param value Candidate value.
 * @returns True when value is readonly unknown array.
 */
function isUnknownArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value)
}

/**
 * Compares two dates by milliseconds value.
 *
 * @param left Left date.
 * @param right Right date.
 * @returns True when dates represent same time.
 */
function datesEqual(left: Date, right: Date): boolean {
    return left.getTime() === right.getTime()
}

/**
 * Compares arrays recursively.
 *
 * @param left Left array.
 * @param right Right array.
 * @returns True when arrays are deeply equal.
 */
function arraysEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
    if (left.length !== right.length) {
        return false
    }

    for (let index = 0; index < left.length; index++) {
        if (!deepEquals(left[index], right[index])) {
            return false
        }
    }

    return true
}

/**
 * Compares record-like objects recursively.
 *
 * @param left Left record.
 * @param right Right record.
 * @returns True when records are deeply equal.
 */
function recordsEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)

    if (leftKeys.length !== rightKeys.length) {
        return false
    }

    for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) {
            return false
        }

        if (!deepEquals(left[key], right[key])) {
            return false
        }
    }

    return true
}

/**
 * Type guard for plain record-like object.
 *
 * @param value Candidate value.
 * @returns True when value is a plain object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)
}
