import type {Connection} from "mongoose"

/**
 * Basic database connection manager contract.
 */
export interface IDatabaseConnectionManager {
    /**
     * Opens active database connection.
     */
    connect(): Promise<void>

    /**
     * Closes active database connection.
     */
    disconnect(): Promise<void>

    /**
     * Returns active connection instance or null.
     */
    getConnection(): Connection | null

    /**
     * Returns true when manager has active connection.
     */
    isConnected(): boolean
}
