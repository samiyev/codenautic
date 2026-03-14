import {describe, expect, test} from "bun:test"

import type {Connection} from "mongoose"

import {MongoConnectionManager} from "../../src/database"

/**
 * Creates minimal mongoose connection mock.
 *
 * @param closeFn Optional close implementation.
 * @returns Connection mock.
 */
function createConnectionMock(
    closeFn: () => Promise<void> = () => Promise.resolve(),
): Connection {
    return {
        close: closeFn,
    } as unknown as Connection
}

describe("MongoConnectionManager", () => {
    test("throws for empty connection uri", () => {
        expect(() => {
            return new MongoConnectionManager({
                uri: "   ",
            })
        }).toThrow("Database connection uri is required")
    })

    test("connect establishes and exposes connection", async () => {
        const connection = createConnectionMock()
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => Promise.resolve(connection),
        })

        await manager.connect()

        expect(manager.isConnected()).toBe(true)
        expect(manager.getConnection()).toBe(connection)
    })

    test("connect is idempotent after successful connection", async () => {
        const connection = createConnectionMock()
        let createCalls = 0
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => {
                createCalls += 1
                return Promise.resolve(connection)
            },
        })

        await manager.connect()
        await manager.connect()

        expect(createCalls).toBe(1)
    })

    test("coalesces concurrent connect calls into one create request", async () => {
        const connection = createConnectionMock()
        let resolveConnect: (() => void) | undefined
        let createCalls = 0
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => {
                createCalls += 1
                return new Promise<Connection>((resolve) => {
                    resolveConnect = () => {
                        resolve(connection)
                    }
                })
            },
        })

        const first = manager.connect()
        const second = manager.connect()

        expect(createCalls).toBe(1)
        expect(resolveConnect).toBeDefined()

        resolveConnect?.()

        await first
        await second
        expect(manager.isConnected()).toBe(true)
    })

    test("disconnect closes active connection and resets state", async () => {
        let closeCalls = 0
        const connection = createConnectionMock(() => {
            closeCalls += 1
            return Promise.resolve()
        })
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => Promise.resolve(connection),
        })

        await manager.connect()
        await manager.disconnect()

        expect(closeCalls).toBe(1)
        expect(manager.isConnected()).toBe(false)
        expect(manager.getConnection()).toBeNull()
    })

    test("disconnect is no-op when no active connection exists", async () => {
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => Promise.resolve(createConnectionMock()),
        })

        await manager.disconnect()

        expect(manager.isConnected()).toBe(false)
        expect(manager.getConnection()).toBeNull()
    })

    test("returns null connection before connect", () => {
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => Promise.resolve(createConnectionMock()),
        })

        expect(manager.getConnection()).toBeNull()
        expect(manager.isConnected()).toBe(false)
    })

    test("resets internal state after failed connect attempt", async () => {
        const connection = createConnectionMock()
        let createCalls = 0
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => {
                createCalls += 1
                if (createCalls === 1) {
                    return Promise.reject(new Error("connect failed"))
                }
                return Promise.resolve(connection)
            },
        })

        try {
            await manager.connect()
            throw new Error("Expected connect to fail")
        } catch (error) {
            expect(error).toBeInstanceOf(Error)
        }

        expect(manager.isConnected()).toBe(false)
        expect(manager.getConnection()).toBeNull()

        await manager.connect()
        expect(manager.isConnected()).toBe(true)
        expect(manager.getConnection()).toBe(connection)
    })

    test("propagates disconnect errors and preserves active connection", async () => {
        const connection = createConnectionMock(() => {
            return Promise.reject(new Error("disconnect failed"))
        })
        const manager = new MongoConnectionManager({
            uri: "mongodb://localhost:27017/codenautic",
            createConnectionFn: () => Promise.resolve(connection),
        })

        await manager.connect()

        try {
            await manager.disconnect()
            throw new Error("Expected disconnect to fail")
        } catch (error) {
            expect(error).toBeInstanceOf(Error)
        }

        expect(manager.isConnected()).toBe(true)
        expect(manager.getConnection()).toBe(connection)
    })
})

