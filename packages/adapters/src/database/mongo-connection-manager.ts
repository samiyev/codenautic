import mongoose, {type Connection} from "mongoose"

import type {IDatabaseConnectionManager} from "./database.types"

/**
 * Initialization options for MongoConnectionManager.
 */
export interface IMongoConnectionManagerOptions {
    /**
     * MongoDB connection URI.
     */
    readonly uri: string

    /**
     * Injectable factory for tests and custom runtime wiring.
     */
    readonly createConnectionFn?: (uri: string) => Promise<Connection>

    /**
     * Injectable close strategy for tests and custom runtime wiring.
     */
    readonly closeConnectionFn?: (connection: Connection) => Promise<void>
}

/**
 * MongoDB connection manager with idempotent connect/disconnect semantics.
 */
export class MongoConnectionManager implements IDatabaseConnectionManager {
    private readonly uri: string
    private readonly createConnectionFn: (uri: string) => Promise<Connection>
    private readonly closeConnectionFn: (connection: Connection) => Promise<void>

    private connection: Connection | null
    private connectPromise: Promise<void> | undefined
    private connected: boolean

    /**
     * Creates MongoDB connection manager.
     *
     * @param options Manager options.
     */
    public constructor(options: IMongoConnectionManagerOptions) {
        this.uri = normalizeRequiredText(options.uri, "uri")
        this.createConnectionFn = options.createConnectionFn ?? createDefaultConnection
        this.closeConnectionFn = options.closeConnectionFn ?? closeDefaultConnection
        this.connection = null
        this.connectPromise = undefined
        this.connected = false
    }

    /**
     * Establishes active MongoDB connection.
     */
    public async connect(): Promise<void> {
        if (this.connected) {
            return
        }

        if (this.connectPromise !== undefined) {
            await this.connectPromise
            return
        }

        this.connectPromise = this.createConnectionFn(this.uri)
            .then((connection) => {
                this.connection = connection
                this.connected = true
            })
            .catch((error: unknown) => {
                this.connection = null
                this.connected = false
                throw error
            })
            .finally(() => {
                this.connectPromise = undefined
            })

        await this.connectPromise
    }

    /**
     * Closes active MongoDB connection.
     */
    public async disconnect(): Promise<void> {
        if (!this.connected || this.connection === null) {
            return
        }

        await this.closeConnectionFn(this.connection)
        this.connection = null
        this.connected = false
    }

    /**
     * Returns active connection instance when available.
     */
    public getConnection(): Connection | null {
        return this.connection
    }

    /**
     * Returns true when manager has active connection.
     */
    public isConnected(): boolean {
        return this.connected && this.connection !== null
    }
}

/**
 * Creates default mongoose connection.
 *
 * @param uri MongoDB connection URI.
 * @returns Open mongoose connection.
 */
async function createDefaultConnection(uri: string): Promise<Connection> {
    const connection = mongoose.createConnection(uri)
    return await connection.asPromise()
}

/**
 * Closes default mongoose connection.
 *
 * @param connection Active connection.
 */
async function closeDefaultConnection(connection: Connection): Promise<void> {
    await connection.close()
}

/**
 * Normalizes required non-empty text value.
 *
 * @param value Raw value.
 * @param fieldName Field name for error message.
 * @returns Trimmed string.
 */
function normalizeRequiredText(value: string, fieldName: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error(`Database connection ${fieldName} is required`)
    }

    return normalized
}

