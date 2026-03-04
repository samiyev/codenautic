import { type ChangeEvent, type FormEvent, type ReactElement, useEffect, useState } from "react"

import { Button } from "@/components/ui"
import { CodeReviewForm } from "@/components/settings/code-review-form"
import { ConfigurationEditor } from "@/components/settings/configuration-editor"
import { IgnorePatternEditor } from "@/components/settings/ignore-pattern-editor"
import { RuleEditor } from "@/components/settings/rule-editor"
import type { ICodeReviewFormValues } from "@/components/settings/settings-form-schemas"
import {
    REPO_REVIEW_MODE,
    type TRepoReviewMode,
} from "@/lib/api/endpoints/repo-config.endpoint"
import { useRepoConfig } from "@/lib/hooks/queries"
import { showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

const DEFAULT_IGNORED_PATHS: ReadonlyArray<string> = ["/dist", "/node_modules", "/coverage"] as const
const DEFAULT_REPOSITORY_ID = "repo-1"
const DEFAULT_REPOSITORY_CONFIG = "version: 1\nreview:\n  mode: MANUAL\n"

interface IDryRunIssue {
    readonly filePath: string
    readonly severity: "low" | "medium" | "high"
    readonly title: string
}

interface IDryRunResult {
    readonly mode: TRepoReviewMode
    readonly reviewedFiles: number
    readonly suggestions: number
    readonly issues: ReadonlyArray<IDryRunIssue>
}

function createDryRunResultSnapshot(params: {
    readonly ignorePatterns: ReadonlyArray<string>
    readonly reviewMode: TRepoReviewMode
}): IDryRunResult {
    const reviewedFiles = Math.max(12 - params.ignorePatterns.length * 2, 1)
    const issues: ReadonlyArray<IDryRunIssue> = [
        {
            filePath: "src/review/pipeline-runner.ts",
            severity: "high",
            title: "Large diff chunk without guard",
        },
        {
            filePath: "src/agents/context-loader.ts",
            severity: "medium",
            title: "Missing timeout fallback branch",
        },
        {
            filePath: "src/domain/events/review-completed.ts",
            severity: "low",
            title: "Event payload can be narrowed",
        },
    ]

    return {
        mode: params.reviewMode,
        reviewedFiles,
        suggestions: issues.length * 2,
        issues,
    }
}

function isRepoReviewMode(value: string): value is TRepoReviewMode {
    return (
        value === REPO_REVIEW_MODE.manual ||
        value === REPO_REVIEW_MODE.auto ||
        value === REPO_REVIEW_MODE.autoPause
    )
}

/**
 * Страница настроек code-review.
 *
 * @returns Форма управления cadence/severity/suggestions + ignore paths.
 */
export function SettingsCodeReviewPage(): ReactElement {
    const [formValues, setFormValues] = useState<ICodeReviewFormValues>({
        cadence: "daily",
        enableDriftSignals: true,
        severity: "medium",
        suggestionsLimit: 8,
    })
    const [ignoredPaths, setIgnoredPaths] = useState<ReadonlyArray<string>>(DEFAULT_IGNORED_PATHS)
    const [rulesText, setRulesText] = useState<string>(
        "### Default review rules\n- Ensure each change has context.\n- Keep patches minimal.",
    )
    const [repositoryId, setRepositoryId] = useState<string>(DEFAULT_REPOSITORY_ID)
    const [configYaml, setConfigYaml] = useState<string>(DEFAULT_REPOSITORY_CONFIG)
    const [reviewMode, setReviewMode] = useState<TRepoReviewMode>(REPO_REVIEW_MODE.manual)
    const [dryRunResult, setDryRunResult] = useState<IDryRunResult | undefined>(undefined)
    const normalizedRepositoryId = repositoryId.trim()
    const repoConfig = useRepoConfig({
        repositoryId: normalizedRepositoryId,
        enabled: normalizedRepositoryId.length > 0,
    })
    const loadedConfig = repoConfig.repoConfigQuery.data?.config

    useEffect((): void => {
        if (loadedConfig === undefined) {
            return
        }

        setConfigYaml(loadedConfig.configYaml)
        setReviewMode(loadedConfig.reviewMode)
        setIgnoredPaths(loadedConfig.ignorePatterns)
    }, [loadedConfig])

    const saveReviewForm = (nextValues: ICodeReviewFormValues): void => {
        setFormValues(nextValues)
        showToastSuccess("Code Review settings saved.")
    }

    const persistRepositoryConfig = (params: {
        readonly configYaml: string
        readonly ignorePatterns: ReadonlyArray<string>
        readonly reviewMode: TRepoReviewMode
        readonly successMessage: string
    }): void => {
        if (normalizedRepositoryId.length === 0) {
            showToastInfo("Repository ID is required.")
            return
        }

        void repoConfig.saveRepoConfig
            .mutateAsync({
                repositoryId: normalizedRepositoryId,
                configYaml: params.configYaml,
                ignorePatterns: params.ignorePatterns,
                reviewMode: params.reviewMode,
            })
            .then((response): void => {
                setConfigYaml(response.config.configYaml)
                setReviewMode(response.config.reviewMode)
                setIgnoredPaths(response.config.ignorePatterns)
                showToastSuccess(params.successMessage)
            })
            .catch((): void => {
                showToastInfo("Unable to save repository config.")
            })
    }

    const handlePathsChange = (nextPaths: ReadonlyArray<string>): void => {
        const normalizedPaths = Array.from(
            new Set(
                nextPaths
                    .map((item): string => item.trim())
                    .filter((item): boolean => item.length > 0),
            ),
        )
        setIgnoredPaths(normalizedPaths)
        persistRepositoryConfig({
            configYaml,
            ignorePatterns: normalizedPaths,
            reviewMode,
            successMessage: "Ignore paths saved.",
        })
    }

    const handlePathReset = (event: FormEvent): void => {
        event.preventDefault()
        const defaultPaths = [...DEFAULT_IGNORED_PATHS]
        setIgnoredPaths(defaultPaths)
        persistRepositoryConfig({
            configYaml,
            ignorePatterns: defaultPaths,
            reviewMode,
            successMessage: "Ignore paths reset to defaults.",
        })
    }

    const handleReviewModeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
        const nextReviewMode = event.currentTarget.value
        if (isRepoReviewMode(nextReviewMode) !== true) {
            return
        }
        setReviewMode(nextReviewMode)
    }

    const handleRepositoryConfigSave = (event: FormEvent): void => {
        event.preventDefault()
        persistRepositoryConfig({
            configYaml,
            ignorePatterns: ignoredPaths,
            reviewMode,
            successMessage: "Repository config saved.",
        })
    }

    const handleRunDryRun = (): void => {
        const result = createDryRunResultSnapshot({
            ignorePatterns: ignoredPaths,
            reviewMode,
        })
        setDryRunResult(result)
        showToastSuccess("Dry-run completed.")
    }

    return (
        <section className="space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900">Code Review Configuration</h1>
            <p className="text-sm text-slate-600">
                Configure repository YAML, cadence, severity threshold and ignore paths for automated
                review.
            </p>
            <ConfigurationEditor
                configYaml={configYaml}
                hasLoadError={repoConfig.repoConfigQuery.error !== null}
                hasSaveError={repoConfig.saveRepoConfig.error !== null}
                isLoading={repoConfig.repoConfigQuery.isPending}
                isSaveDisabled={
                    normalizedRepositoryId.length === 0 ||
                    repoConfig.saveRepoConfig.isPending === true
                }
                isSaving={repoConfig.saveRepoConfig.isPending}
                repositoryId={repositoryId}
                reviewMode={reviewMode}
                onConfigYamlChange={setConfigYaml}
                onRepositoryIdChange={setRepositoryId}
                onReviewModeChange={handleReviewModeChange}
                onSave={handleRepositoryConfigSave}
            />
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-semibold text-slate-900">Dry-run results</h2>
                <p className="text-sm text-slate-600">
                    Preview review findings before switching cadence or running full automation.
                </p>
                <Button type="button" variant="solid" onPress={handleRunDryRun}>
                    Run dry-run
                </Button>
                {dryRunResult === undefined ? (
                    <p className="text-xs text-slate-500" data-testid="dry-run-empty">
                        Run dry-run to preview current review output.
                    </p>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-slate-700" data-testid="dry-run-summary">
                            {`Mode: ${dryRunResult.mode} · Reviewed files: ${dryRunResult.reviewedFiles} · Suggestions: ${dryRunResult.suggestions}`}
                        </p>
                        <ul className="space-y-1 text-xs text-slate-600">
                            {dryRunResult.issues.map((issue): ReactElement => (
                                <li key={`${issue.filePath}-${issue.title}`} data-testid="dry-run-issue-row">
                                    {`${issue.filePath} · ${issue.severity.toUpperCase()} · ${issue.title}`}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>
            <CodeReviewForm initialValues={formValues} onSubmit={saveReviewForm} />
            <IgnorePatternEditor
                helperText="Ignore patterns filter scan scope and CCR output."
                ignoredPatterns={ignoredPaths}
                onChange={handlePathsChange}
            />
            <RuleEditor
                id="code-review-rules-editor"
                label="Review rules"
                maxLength={4000}
                onChange={setRulesText}
                value={rulesText}
            />
            <form onSubmit={handlePathReset}>
                <Button
                    type="submit"
                    className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
                >
                    Reset ignore paths
                </Button>
            </form>
        </section>
    )
}
