import {describe, expect, test} from "bun:test"

import {LineRange} from "../../../src/domain/value-objects/line-range.value-object"

describe("LineRange", () => {
    test("creates range with expected boundaries and derived values", () => {
        const range = LineRange.create(10, 15)

        expect(range.start).toBe(10)
        expect(range.end).toBe(15)
        expect(range.length).toBe(6)
        expect(range.toString()).toBe("L10-L15")
    })

    test("supports single-line ranges", () => {
        const range = LineRange.create(7, 7)

        expect(range.length).toBe(1)
        expect(range.contains(7)).toBe(true)
        expect(range.toString()).toBe("L7-L7")
    })

    test("throws when start is less than one", () => {
        expect(() => {
            LineRange.create(0, 1)
        }).toThrow("LineRange start must be greater than or equal to 1")
    })

    test("throws when end is less than start", () => {
        expect(() => {
            LineRange.create(5, 4)
        }).toThrow("LineRange end must be greater than or equal to start")
    })

    test("throws when boundaries are not integers", () => {
        expect(() => {
            LineRange.create(1.5, 5)
        }).toThrow("LineRange boundaries must be integers")

        expect(() => {
            LineRange.create(1, Number.NaN)
        }).toThrow("LineRange boundaries must be integers")
    })

    test("contains checks whether line is inside the range", () => {
        const range = LineRange.create(10, 15)

        expect(range.contains(10)).toBe(true)
        expect(range.contains(13)).toBe(true)
        expect(range.contains(15)).toBe(true)
        expect(range.contains(9)).toBe(false)
        expect(range.contains(16)).toBe(false)
        expect(range.contains(10.5)).toBe(false)
    })

    test("overlaps returns true for intersecting ranges", () => {
        const first = LineRange.create(10, 20)
        const second = LineRange.create(20, 25)
        const third = LineRange.create(14, 18)

        expect(first.overlaps(second)).toBe(true)
        expect(first.overlaps(third)).toBe(true)
    })

    test("overlaps returns false for disjoint ranges", () => {
        const first = LineRange.create(10, 15)
        const second = LineRange.create(16, 20)

        expect(first.overlaps(second)).toBe(false)
        expect(second.overlaps(first)).toBe(false)
    })
})
