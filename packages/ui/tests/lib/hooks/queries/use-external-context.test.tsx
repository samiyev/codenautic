import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "../../../utils/render"
import { server } from "../../../mocks/server"
import {
    useExternalContext,
    type IUseExternalContextResult,
} from "@/lib/hooks/queries/use-external-context"
import {
    EXTERNAL_CONTEXT_SOURCE_TYPE,
    EXTERNAL_CONTEXT_STATUS,
    type IExternalContextSource,
} from "@/lib/api/endpoints/external-context.endpoint"

const BASE_SOURCE: IExternalContextSource = {
    id: "source-jira",
    name: "Jira issues",
    type: EXTERNAL_CONTEXT_SOURCE_TYPE.jira,
    status: EXTERNAL_CONTEXT_STATUS.connected,
    enabled: true,
    itemCount: 120,
    lastSyncedAt: "2026-03-05T05:00:00Z",
}

function ExternalContextProbe(): ReactElement {
    const hook = useExternalContext({
        selectedSourceId: BASE_SOURCE.id,
    })
    const [updateStatus, setUpdateStatus] = useState<string>("idle")
    const [refreshStatus, setRefreshStatus] = useState<string>("idle")

    return (
        <div>
            <ExternalContextState {...hook} />
            <p data-testid="update-status">{updateStatus}</p>
            <p data-testid="refresh-status">{refreshStatus}</p>
            <button
                data-testid="toggle-source"
                disabled={hook.updateSource.isPending}
                onClick={(): void => {
                    void toggleSource(hook, setUpdateStatus)
                }}
                type="button"
            >
                Toggle source
            </button>
            <button
                data-testid="refresh-source"
                disabled={hook.refreshSource.isPending}
                onClick={(): void => {
                    void refreshSource(hook, setRefreshStatus)
                }}
                type="button"
            >
                Refresh source
            </button>
        </div>
    )
}

function ExternalContextState(hook: IUseExternalContextResult): ReactElement {
    if (hook.sourcesQuery.isPending || hook.previewQuery.isPending) {
        return <p data-testid="external-context-state">pending</p>
    }

    if (hook.sourcesQuery.error !== null || hook.previewQuery.error !== null) {
        return <p data-testid="external-context-state">error</p>
    }

    const firstSource = hook.sourcesQuery.data?.sources.at(0)
    return (
        <div>
            <p data-testid="sources-count">{hook.sourcesQuery.data?.sources.length ?? 0}</p>
            <p data-testid="preview-count">{hook.previewQuery.data?.items.length ?? 0}</p>
            <p data-testid="source-enabled">{String(firstSource?.enabled ?? false)}</p>
            <p data-testid="source-status">{firstSource?.status ?? "UNKNOWN"}</p>
        </div>
    )
}

async function toggleSource(
    hook: IUseExternalContextResult,
    setStatus: (next: string) => void,
): Promise<void> {
    setStatus("loading")
    const response = await hook.updateSource.mutateAsync({
        sourceId: BASE_SOURCE.id,
        enabled: false,
    })
    setStatus(`updated:${response.source.enabled ? "on" : "off"}`)
}

async function refreshSource(
    hook: IUseExternalContextResult,
    setStatus: (next: string) => void,
): Promise<void> {
    setStatus("loading")
    const response = await hook.refreshSource.mutateAsync(BASE_SOURCE.id)
    setStatus(`refreshed:${response.status}`)
}

describe("useExternalContext", (): void => {
    it("загружает список sources и preview выбранного source", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:3000/api/v1/context/sources", () => {
                return HttpResponse.json({
                    sources: [BASE_SOURCE],
                    total: 1,
                })
            }),
            http.get("http://localhost:3000/api/v1/context/sources/source-jira/preview", () => {
                return HttpResponse.json({
                    sourceId: BASE_SOURCE.id,
                    items: [
                        {
                            id: "preview-1",
                            title: "Issue CN-123",
                            excerpt: "Build pipeline failed with timeout",
                            url: "https://acme.atlassian.net/browse/CN-123",
                        },
                    ],
                    total: 1,
                })
            }),
        )

        renderWithProviders(<ExternalContextProbe />)
        expect(screen.getByTestId("external-context-state").textContent).toBe("pending")

        expect(await screen.findByTestId("sources-count")).toHaveTextContent("1")
        expect(screen.getByTestId("preview-count")).toHaveTextContent("1")
        expect(screen.getByTestId("source-enabled")).toHaveTextContent("true")
    })

    it("обновляет source и применяет optimistic update", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:3000/api/v1/context/sources", () => {
                return HttpResponse.json({
                    sources: [BASE_SOURCE],
                    total: 1,
                })
            }),
            http.get("http://localhost:3000/api/v1/context/sources/source-jira/preview", () => {
                return HttpResponse.json({
                    sourceId: BASE_SOURCE.id,
                    items: [],
                    total: 0,
                })
            }),
            http.put("http://localhost:3000/api/v1/context/sources/source-jira", () => {
                return HttpResponse.json({
                    source: {
                        ...BASE_SOURCE,
                        enabled: false,
                    },
                })
            }),
        )

        renderWithProviders(<ExternalContextProbe />)
        expect(await screen.findByTestId("sources-count")).toHaveTextContent("1")
        await userEvent.click(screen.getByTestId("toggle-source"))

        await waitFor((): void => {
            expect(screen.getByTestId("update-status")).toHaveTextContent("updated:off")
        })
    })

    it("запускает refresh source и обновляет статус", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:3000/api/v1/context/sources", () => {
                return HttpResponse.json({
                    sources: [BASE_SOURCE],
                    total: 1,
                })
            }),
            http.get("http://localhost:3000/api/v1/context/sources/source-jira/preview", () => {
                return HttpResponse.json({
                    sourceId: BASE_SOURCE.id,
                    items: [],
                    total: 0,
                })
            }),
            http.post("http://localhost:3000/api/v1/context/sources/source-jira/refresh", () => {
                return HttpResponse.json({
                    sourceId: BASE_SOURCE.id,
                    accepted: true,
                    status: EXTERNAL_CONTEXT_STATUS.syncing,
                })
            }),
        )

        renderWithProviders(<ExternalContextProbe />)
        expect(await screen.findByTestId("sources-count")).toHaveTextContent("1")
        await userEvent.click(screen.getByTestId("refresh-source"))

        await waitFor((): void => {
            expect(screen.getByTestId("refresh-status")).toHaveTextContent("refreshed:SYNCING")
        })
    })
})
