import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { useReviewCadence } from "@/lib/hooks/queries/use-review-cadence"
import { server } from "../../../mocks/server"
import { renderWithProviders } from "../../../utils/render"

function ReviewCadenceProbe(): ReactElement {
    const hook = useReviewCadence()
    const [status, setStatus] = useState<string>("idle")

    return (
        <div>
            <p data-testid="cadence-status">{status}</p>
            <button
                data-testid="save-cadence"
                disabled={hook.updateCadence.isPending}
                onClick={(): void => {
                    void saveCadence(hook, setStatus)
                }}
                type="button"
            >
                Save cadence
            </button>
        </div>
    )
}

async function saveCadence(
    hook: ReturnType<typeof useReviewCadence>,
    setStatus: (next: string) => void,
): Promise<void> {
    setStatus("loading")
    const response = await hook.updateCadence.mutateAsync({
        repositoryId: "repo-1",
        reviewMode: "AUTO_PAUSE",
    })
    setStatus(`saved:${response.config.reviewMode}`)
}

function ReviewCadenceErrorProbe(): ReactElement {
    const hook = useReviewCadence()
    const [status, setStatus] = useState<string>("idle")

    return (
        <div>
            <p data-testid="cadence-status">{status}</p>
            <button
                data-testid="save-cadence"
                disabled={hook.updateCadence.isPending}
                onClick={(): void => {
                    void hook.updateCadence
                        .mutateAsync({
                            repositoryId: "repo-fail",
                            reviewMode: "AUTO",
                        })
                        .then((response): void => {
                            setStatus(`saved:${response.config.reviewMode}`)
                        })
                        .catch((): void => {
                            setStatus("error")
                        })
                }}
                type="button"
            >
                Save cadence
            </button>
        </div>
    )
}

function ReviewCadenceManualProbe(): ReactElement {
    const hook = useReviewCadence()
    const [status, setStatus] = useState<string>("idle")

    return (
        <div>
            <p data-testid="cadence-status">{status}</p>
            <button
                data-testid="save-cadence"
                disabled={hook.updateCadence.isPending}
                onClick={(): void => {
                    void saveCadenceManual(hook, setStatus)
                }}
                type="button"
            >
                Save cadence
            </button>
        </div>
    )
}

async function saveCadenceManual(
    hook: ReturnType<typeof useReviewCadence>,
    setStatus: (next: string) => void,
): Promise<void> {
    setStatus("loading")
    const response = await hook.updateCadence.mutateAsync({
        repositoryId: "repo-2",
        reviewMode: "MANUAL",
    })
    setStatus(`saved:${response.config.reviewMode}`)
}

describe("useReviewCadence", (): void => {
    it("сохраняет cadence mode через repo config endpoint", async (): Promise<void> => {
        server.use(
            http.put("http://localhost:7120/api/v1/repositories/repo-1/config", async () => {
                return HttpResponse.json({
                    config: {
                        repositoryId: "repo-1",
                        configYaml: "version: 1\nreview:\n  mode: AUTO_PAUSE\n",
                        ignorePatterns: ["/dist"],
                        reviewMode: "AUTO_PAUSE",
                    },
                })
            }),
        )

        renderWithProviders(<ReviewCadenceProbe />)
        await userEvent.click(screen.getByTestId("save-cadence"))

        await waitFor((): void => {
            expect(screen.getByTestId("cadence-status")).toHaveTextContent("saved:AUTO_PAUSE")
        })
    })

    it("сохраняет MANUAL режим", async (): Promise<void> => {
        server.use(
            http.put("http://localhost:7120/api/v1/repositories/repo-2/config", async () => {
                return HttpResponse.json({
                    config: {
                        repositoryId: "repo-2",
                        configYaml: "version: 1\nreview:\n  mode: MANUAL\n",
                        ignorePatterns: [],
                        reviewMode: "MANUAL",
                    },
                })
            }),
        )

        renderWithProviders(<ReviewCadenceManualProbe />)
        await userEvent.click(screen.getByTestId("save-cadence"))

        await waitFor((): void => {
            expect(screen.getByTestId("cadence-status")).toHaveTextContent("saved:MANUAL")
        })
    })

    it("обрабатывает ошибку при сохранении cadence", async (): Promise<void> => {
        server.use(
            http.put("http://localhost:7120/api/v1/repositories/repo-fail/config", () => {
                return HttpResponse.json({ error: "Repository config not found" }, { status: 404 })
            }),
        )

        renderWithProviders(<ReviewCadenceErrorProbe />)
        await userEvent.click(screen.getByTestId("save-cadence"))

        await waitFor((): void => {
            expect(screen.getByTestId("cadence-status")).toHaveTextContent("error")
        })
    })

    it("начинает с idle состояния до вызова мутации", (): void => {
        renderWithProviders(<ReviewCadenceProbe />)

        expect(screen.getByTestId("cadence-status")).toHaveTextContent("idle")
    })

    it("показывает loading при ожидании ответа", async (): Promise<void> => {
        server.use(
            http.put("http://localhost:7120/api/v1/repositories/repo-1/config", async () => {
                await new Promise((resolve): void => {
                    setTimeout(resolve, 100)
                })
                return HttpResponse.json({
                    config: {
                        repositoryId: "repo-1",
                        configYaml: "version: 1\nreview:\n  mode: AUTO_PAUSE\n",
                        ignorePatterns: [],
                        reviewMode: "AUTO_PAUSE",
                    },
                })
            }),
        )

        renderWithProviders(<ReviewCadenceProbe />)
        await userEvent.click(screen.getByTestId("save-cadence"))

        expect(screen.getByTestId("cadence-status")).toHaveTextContent("loading")

        await waitFor((): void => {
            expect(screen.getByTestId("cadence-status")).toHaveTextContent("saved:AUTO_PAUSE")
        })
    })
})
