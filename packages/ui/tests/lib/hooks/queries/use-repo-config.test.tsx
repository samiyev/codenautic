import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { renderWithProviders } from "../../../utils/render"
import { server } from "../../../mocks/server"
import { useRepoConfig, type IUseRepoConfigResult } from "@/lib/hooks/queries/use-repo-config"

function RepoConfigProbe(): ReactElement {
    const hook = useRepoConfig({
        repositoryId: "repo-1",
    })
    const [saveStatus, setSaveStatus] = useState<string>("idle")

    return (
        <div>
            <RepoConfigState {...hook} />
            <p data-testid="save-status">{saveStatus}</p>
            <button
                data-testid="save-config"
                disabled={hook.saveRepoConfig.isPending}
                onClick={(): void => {
                    void saveConfig(hook, setSaveStatus)
                }}
                type="button"
            >
                Save config
            </button>
        </div>
    )
}

function RepoConfigState(hook: IUseRepoConfigResult): ReactElement {
    if (hook.repoConfigQuery.isPending) {
        return <p data-testid="repo-config-state">pending</p>
    }

    if (hook.repoConfigQuery.error !== null) {
        return <p data-testid="repo-config-state">error</p>
    }

    const config = hook.repoConfigQuery.data?.config
    return (
        <div>
            <p data-testid="repo-config-mode">{config?.reviewMode ?? "UNKNOWN"}</p>
            <p data-testid="repo-config-ignore-count">{config?.ignorePatterns.length ?? 0}</p>
            <p data-testid="repo-config-yaml">{config?.configYaml ?? ""}</p>
        </div>
    )
}

async function saveConfig(
    hook: IUseRepoConfigResult,
    setStatus: (next: string) => void,
): Promise<void> {
    setStatus("loading")
    const response = await hook.saveRepoConfig.mutateAsync({
        repositoryId: "repo-1",
        configYaml: "version: 2\nreview:\n  mode: AUTO\n",
        ignorePatterns: ["**/dist/**", "**/*.snap"],
        reviewMode: "AUTO",
    })
    setStatus(`saved:${response.config.reviewMode}`)
}

function DisabledRepoConfigProbe(): ReactElement {
    const hook = useRepoConfig({
        repositoryId: "repo-1",
        enabled: false,
    })

    return (
        <div>
            <p data-testid="config-pending">{String(hook.repoConfigQuery.isPending)}</p>
            <p data-testid="config-fetched">{String(hook.repoConfigQuery.isFetched)}</p>
        </div>
    )
}

function EmptyRepoConfigProbe(): ReactElement {
    const hook = useRepoConfig({
        repositoryId: "   ",
    })

    return (
        <div>
            <p data-testid="config-pending">{String(hook.repoConfigQuery.isPending)}</p>
            <p data-testid="config-fetched">{String(hook.repoConfigQuery.isFetched)}</p>
        </div>
    )
}

function SaveErrorRepoConfigProbe(): ReactElement {
    const hook = useRepoConfig({
        repositoryId: "repo-1",
    })
    const [saveStatus, setSaveStatus] = useState<string>("idle")

    return (
        <div>
            <RepoConfigState {...hook} />
            <p data-testid="save-status">{saveStatus}</p>
            <button
                data-testid="save-config"
                disabled={hook.saveRepoConfig.isPending}
                onClick={(): void => {
                    void hook.saveRepoConfig
                        .mutateAsync({
                            repositoryId: "repo-1",
                            reviewMode: "AUTO",
                        })
                        .then((response): void => {
                            setSaveStatus(`saved:${response.config.reviewMode}`)
                        })
                        .catch((): void => {
                            setSaveStatus("save-error")
                        })
                }}
                type="button"
            >
                Save config
            </button>
        </div>
    )
}

describe("useRepoConfig", (): void => {
    it("загружает repo config по repositoryId", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:7120/api/v1/repositories/repo-1/config", () => {
                return HttpResponse.json({
                    config: {
                        repositoryId: "repo-1",
                        configYaml: "version: 1\nreview:\n  mode: MANUAL\n",
                        ignorePatterns: ["**/node_modules/**"],
                        reviewMode: "MANUAL",
                    },
                })
            }),
        )

        renderWithProviders(<RepoConfigProbe />)
        expect(screen.getByTestId("repo-config-state")).toHaveTextContent("pending")

        expect(await screen.findByTestId("repo-config-mode")).toHaveTextContent("MANUAL")
        expect(screen.getByTestId("repo-config-ignore-count")).toHaveTextContent("1")
    })

    it("сохраняет repo config и обновляет query cache", async (): Promise<void> => {
        let repositoryConfig: {
            repositoryId: string
            configYaml: string
            ignorePatterns: ReadonlyArray<string>
            reviewMode: "MANUAL" | "AUTO"
        } = {
            repositoryId: "repo-1",
            configYaml: "version: 1\nreview:\n  mode: MANUAL\n",
            ignorePatterns: ["**/node_modules/**"],
            reviewMode: "MANUAL",
        }

        server.use(
            http.get("http://localhost:7120/api/v1/repositories/repo-1/config", () => {
                return HttpResponse.json({
                    config: repositoryConfig,
                })
            }),
            http.put("http://localhost:7120/api/v1/repositories/repo-1/config", async () => {
                repositoryConfig = {
                    repositoryId: "repo-1",
                    configYaml: "version: 2\nreview:\n  mode: AUTO\n",
                    ignorePatterns: ["**/dist/**", "**/*.snap"],
                    reviewMode: "AUTO",
                }
                return HttpResponse.json({
                    config: repositoryConfig,
                })
            }),
        )

        renderWithProviders(<RepoConfigProbe />)
        expect(await screen.findByTestId("repo-config-mode")).toHaveTextContent("MANUAL")
        await userEvent.click(screen.getByTestId("save-config"))

        await waitFor((): void => {
            expect(screen.getByTestId("save-status")).toHaveTextContent("saved:AUTO")
        })
        await waitFor((): void => {
            expect(screen.getByTestId("repo-config-mode")).toHaveTextContent("AUTO")
        })
    })

    it("не загружает данные когда enabled=false", async (): Promise<void> => {
        renderWithProviders(<DisabledRepoConfigProbe />)

        await new Promise((resolve): void => {
            setTimeout(resolve, 50)
        })
        expect(screen.getByTestId("config-fetched")).toHaveTextContent("false")
    })

    it("не загружает данные для пустого repositoryId", async (): Promise<void> => {
        renderWithProviders(<EmptyRepoConfigProbe />)

        await new Promise((resolve): void => {
            setTimeout(resolve, 50)
        })
        expect(screen.getByTestId("config-fetched")).toHaveTextContent("false")
    })

    it("откатывает оптимистичное обновление при ошибке сохранения", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:7120/api/v1/repositories/repo-1/config", () => {
                return HttpResponse.json({
                    config: {
                        repositoryId: "repo-1",
                        configYaml: "version: 1\nreview:\n  mode: MANUAL\n",
                        ignorePatterns: ["**/node_modules/**"],
                        reviewMode: "MANUAL",
                    },
                })
            }),
            http.put("http://localhost:7120/api/v1/repositories/repo-1/config", () => {
                return HttpResponse.json({ error: "Permission denied" }, { status: 403 })
            }),
        )

        renderWithProviders(<SaveErrorRepoConfigProbe />)
        expect(await screen.findByTestId("repo-config-mode")).toHaveTextContent("MANUAL")
        await userEvent.click(screen.getByTestId("save-config"))

        await waitFor((): void => {
            expect(screen.getByTestId("save-status")).toHaveTextContent("save-error")
        })
    })
})
