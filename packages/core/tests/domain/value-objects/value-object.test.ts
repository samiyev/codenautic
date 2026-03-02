import {describe, expect, test} from "bun:test"

import {ValueObject} from "../../../src/domain/value-objects/value-object"

interface IAmountProps {
    value: number
    metadata: {
        currency: string
    }
}

class AmountValueObject extends ValueObject<IAmountProps> {
    private static validationCalls = 0

    public static create(props: IAmountProps): AmountValueObject {
        return new AmountValueObject(props)
    }

    public static getValidationCalls(): number {
        return AmountValueObject.validationCalls
    }

    public static resetValidationCalls(): void {
        AmountValueObject.validationCalls = 0
    }

    public propsSnapshot(): IAmountProps {
        return this.props
    }

    protected validate(props: IAmountProps): void {
        AmountValueObject.validationCalls += 1

        if (props.value <= 0) {
            throw new Error("Amount must be greater than zero")
        }
    }
}

class DiscountValueObject extends ValueObject<IAmountProps> {
    public static create(props: IAmountProps): DiscountValueObject {
        return new DiscountValueObject(props)
    }

    protected validate(_props: IAmountProps): void {}
}

describe("ValueObject", () => {
    test("calls validate during construction", () => {
        AmountValueObject.resetValidationCalls()

        void AmountValueObject.create({
            value: 10,
            metadata: {currency: "USD"},
        })

        expect(AmountValueObject.getValidationCalls()).toBe(1)
    })

    test("throws when props are invalid", () => {
        expect(() => {
            AmountValueObject.create({
                value: 0,
                metadata: {currency: "USD"},
            })
        }).toThrow("Amount must be greater than zero")
    })

    test("freezes props shallowly", () => {
        const amount = AmountValueObject.create({
            value: 10,
            metadata: {currency: "USD"},
        })
        const props = amount.propsSnapshot()

        expect(Object.isFrozen(props)).toBe(true)

        expect(() => {
            props.value = 99
        }).toThrow()

        props.metadata.currency = "EUR"
        expect(props.metadata.currency).toBe("EUR")
    })

    test("isEqual returns true for same values", () => {
        const left = AmountValueObject.create({
            value: 10,
            metadata: {currency: "USD"},
        })
        const right = AmountValueObject.create({
            value: 10,
            metadata: {currency: "USD"},
        })

        expect(left.isEqual(right)).toBe(true)
        expect(left.equals(right)).toBe(true)
    })

    test("isEqual returns false for different values, null and other type", () => {
        const left = AmountValueObject.create({
            value: 10,
            metadata: {currency: "USD"},
        })
        const different = AmountValueObject.create({
            value: 11,
            metadata: {currency: "USD"},
        })
        const otherType = DiscountValueObject.create({
            value: 10,
            metadata: {currency: "USD"},
        })

        expect(left.isEqual(different)).toBe(false)
        expect(left.isEqual(null)).toBe(false)
        expect(left.isEqual(undefined)).toBe(false)
        expect(left.isEqual(otherType)).toBe(false)
    })
})
