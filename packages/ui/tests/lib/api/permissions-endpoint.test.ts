import { describe, expect, it, vi } from "vitest"

import type { IHttpClient } from "@/lib/api"
import type { IPermissionsResponse } from "@/lib/permissions/permissions"
import { PermissionsApi } from "@/lib/api/endpoints/permissions.endpoint"

/**
 * Создаёт типизированный mock HTTP-клиента.
 *
 * @returns Пара клиента и mock-функции request.
 */
function createHttpClientMock(): {
    readonly httpClient: IHttpClient
    readonly requestMock: ReturnType<typeof vi.fn>
} {
    const requestMock = vi.fn()
    return {
        httpClient: {
            request: requestMock,
        },
        requestMock,
    }
}

describe("PermissionsApi", (): void => {
    it("получает permissions для anonymous роли без доп. query", async (): Promise<void> => {
        const response: IPermissionsResponse = {
            permissions: [],
        }
        const { httpClient, requestMock } = createHttpClientMock()
        requestMock.mockResolvedValueOnce(response)

        const api = new PermissionsApi(httpClient)
        const result = await api.getPermissions()

        expect(result).toEqual(response)
        expect(requestMock).toHaveBeenCalledWith({
            method: "GET",
            path: "/api/v1/permissions",
            query: {
                role: "anonymous",
            },
            credentials: "include",
        })
    })

    it("передаёт role hint при явном вызове", async (): Promise<void> => {
        const response: IPermissionsResponse = {
            permissions: [],
        }
        const { httpClient, requestMock } = createHttpClientMock()
        requestMock.mockResolvedValueOnce(response)

        const api = new PermissionsApi(httpClient)
        const result = await api.getPermissions("admin")

        expect(result).toEqual(response)
        expect(requestMock).toHaveBeenCalledWith({
            method: "GET",
            path: "/api/v1/permissions",
            query: {
                role: "admin",
            },
            credentials: "include",
        })
    })
})
