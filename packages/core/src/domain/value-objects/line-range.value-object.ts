/**
 * Immutable value object that represents an inclusive line interval.
 */
export class LineRange {
    private readonly startLine: number
    private readonly endLine: number

    /**
     * Creates immutable line range.
     *
     * @param startLine Start line number (inclusive).
     * @param endLine End line number (inclusive).
     */
    private constructor(startLine: number, endLine: number) {
        this.startLine = startLine
        this.endLine = endLine
        Object.freeze(this)
    }

    /**
     * Creates validated line range.
     *
     * @param start Start line number (1-based, inclusive).
     * @param end End line number (1-based, inclusive).
     * @returns Immutable line range.
     * @throws Error When boundaries are not integers.
     * @throws Error When start is less than one.
     * @throws Error When end is less than start.
     */
    public static create(start: number, end: number): LineRange {
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
            throw new Error("LineRange boundaries must be integers")
        }

        if (start < 1) {
            throw new Error("LineRange start must be greater than or equal to 1")
        }

        if (end < start) {
            throw new Error("LineRange end must be greater than or equal to start")
        }

        return new LineRange(start, end)
    }

    /**
     * Start boundary of range.
     *
     * @returns Start line number.
     */
    public get start(): number {
        return this.startLine
    }

    /**
     * End boundary of range.
     *
     * @returns End line number.
     */
    public get end(): number {
        return this.endLine
    }

    /**
     * Inclusive number of lines inside range.
     *
     * @returns Number of lines.
     */
    public get length(): number {
        return this.endLine - this.startLine + 1
    }

    /**
     * Checks whether range contains target line.
     *
     * @param line Candidate line number.
     * @returns True when candidate line is inside range.
     */
    public contains(line: number): boolean {
        if (!Number.isInteger(line)) {
            return false
        }

        return line >= this.startLine && line <= this.endLine
    }

    /**
     * Checks whether range overlaps with another range.
     *
     * @param other Another line range.
     * @returns True when ranges share at least one line.
     */
    public overlaps(other: LineRange): boolean {
        return this.startLine <= other.endLine && other.startLine <= this.endLine
    }

    /**
     * Converts line range to compact stable representation.
     *
     * @returns String in format `L{start}-L{end}`.
     */
    public toString(): string {
        return `L${this.startLine}-L${this.endLine}`
    }
}
