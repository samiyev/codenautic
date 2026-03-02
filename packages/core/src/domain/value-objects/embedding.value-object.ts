import {similarity} from "../../shared/utils/similarity"

/**
 * Input contract for creating embedding value object.
 */
export interface ICreateEmbeddingProps {
    readonly vector: readonly number[]
    readonly dimensions: number
    readonly model: string
    readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Immutable embedding representation with cosine similarity helper.
 */
export class Embedding {
    private readonly embeddingVector: readonly number[]
    private readonly embeddingDimensions: number
    private readonly embeddingModel: string
    private readonly embeddingMetadata?: Readonly<Record<string, unknown>>

    /**
     * Creates immutable embedding value object.
     *
     * @param props Validated embedding props.
     */
    private constructor(props: ICreateEmbeddingProps) {
        this.embeddingVector = Object.freeze([...props.vector])
        this.embeddingDimensions = props.dimensions
        this.embeddingModel = props.model
        this.embeddingMetadata = cloneMetadata(props.metadata)
        Object.freeze(this)
    }

    /**
     * Creates validated embedding value object.
     *
     * @param props Raw embedding props.
     * @returns Immutable embedding.
     * @throws Error When dimensions are invalid.
     * @throws Error When dimensions and vector length mismatch.
     * @throws Error When model is empty after trim.
     */
    public static create(props: ICreateEmbeddingProps): Embedding {
        if (!Number.isInteger(props.dimensions) || props.dimensions <= 0) {
            throw new Error("Embedding dimensions must be a positive integer")
        }

        if (props.dimensions !== props.vector.length) {
            throw new Error("Embedding dimensions must match vector length")
        }

        if (props.model.trim().length === 0) {
            throw new Error("Embedding model cannot be empty")
        }

        return new Embedding(props)
    }

    /**
     * Embedding numeric vector.
     *
     * @returns Immutable vector copy.
     */
    public get vector(): ReadonlyArray<number> {
        return [...this.embeddingVector]
    }

    /**
     * Declared embedding dimensions.
     *
     * @returns Embedding dimensions.
     */
    public get dimensions(): number {
        return this.embeddingDimensions
    }

    /**
     * Embedding model identifier.
     *
     * @returns Model name.
     */
    public get model(): string {
        return this.embeddingModel
    }

    /**
     * Optional metadata associated with embedding.
     *
     * @returns Metadata copy or undefined.
     */
    public get metadata(): Readonly<Record<string, unknown>> | undefined {
        return cloneMetadata(this.embeddingMetadata)
    }

    /**
     * Computes cosine similarity with another embedding vector.
     *
     * @param other Another embedding instance.
     * @returns Cosine similarity score.
     */
    public similarity(other: Embedding): number {
        return similarity(this.embeddingVector, other.embeddingVector)
    }
}

/**
 * Creates immutable metadata clone when metadata exists.
 *
 * @param metadata Optional metadata object.
 * @returns Frozen metadata copy or undefined.
 */
function cloneMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
    if (metadata === undefined) {
        return undefined
    }

    return Object.freeze({...metadata})
}
