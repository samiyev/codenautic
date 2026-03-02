import {http, HttpResponse} from "msw"
import {setupServer} from "msw/node"

/**
 * Дефолтный мок health endpoint для UI-интеграционных тестов.
 */
export const server = setupServer(
    http.get("http://localhost:3000/api/v1/health", () => {
        return HttpResponse.json({
            status: "ok",
            service: "api",
            timestamp: "2026-03-02T00:00:00.000Z",
        })
    }),
)
