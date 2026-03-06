import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {StageError} from "../../../domain/errors/stage.error"
import {Result} from "../../../shared/result"
import {
    isPipelineCollectionItem,
    mergeExternalContext,
    readObjectField,
} from "./pipeline-stage-state.utils"
import type {IFileContextGateDefaults} from "../../dto/config/system-defaults.dto"
import type {ISystemSettingsProvider} from "../../ports/outbound/common/system-settings-provider.port"

const FILE_CONTEXT_GATE_DEFAULTS: IFileContextGateDefaults = {
    batchSize: 30,
}

const FILE_CONTEXT_GATE_SETTINGS_KEY = "review.file_context_gate_defaults"

/**
 * Stage 8 use case. Filters files by context availability and creates processing batches.
 */
export class FileContextGateStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string
    private readonly defaults: IFileContextGateDefaults
    private readonly systemSettingsProvider?: ISystemSettingsProvider

    /**
     * Creates file-context-gate stage use case.
     */
    public constructor(
        defaults: IFileContextGateDefaults = FILE_CONTEXT_GATE_DEFAULTS,
        systemSettingsProvider?: ISystemSettingsProvider,
    ) {
        this.stageId = "file-context-gate"
        this.stageName = "File Context Gate"
        this.defaults = defaults
        this.systemSettingsProvider = systemSettingsProvider
    }

    /**
     * Applies context gate to files and writes batch plan into externalContext.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const files = input.state.files.filter((file): boolean => {
            return isPipelineCollectionItem(file)
        })
        const contextPaths = this.resolveContextPaths(input.state.externalContext)

        const filteredFiles = files.filter((file): boolean => {
            const rawPath = file["path"]
            if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
                return false
            }

            if (contextPaths.size === 0) {
                return true
            }

            return contextPaths.has(rawPath.trim())
        })

        const batchSize = await this.resolveBatchSize(input.state.config)
        const batches = this.createBatches(filteredFiles, batchSize)

        return Result.ok<IStageTransition, StageError>({
            state: input.state.with({
                files: filteredFiles,
                externalContext: mergeExternalContext(input.state.externalContext, {
                    batches,
                    fileContextGate: {
                        batchSize,
                        batchCount: batches.length,
                        eligibleFileCount: filteredFiles.length,
                        filteredOutCount: files.length - filteredFiles.length,
                    },
                }),
            }),
            metadata: {
                checkpointHint: "file-context-gate:completed",
            },
        })
    }

    /**
     * Resolves configured batch size or returns default.
     *
     * @param config Config payload.
     * @returns Batch size.
     */
    private async resolveBatchSize(config: Readonly<Record<string, unknown>>): Promise<number> {
        const configBatchSize = this.readBatchSize(config["batchSize"])
        if (configBatchSize !== undefined) {
            return configBatchSize
        }

        return this.resolveBatchSizeFromSettings()
    }

    /**
     * Reads settings defaults for batch size.
     *
     * @returns Batch size from settings or fallback.
     */
    private async resolveBatchSizeFromSettings(): Promise<number> {
        if (this.systemSettingsProvider === undefined) {
            return this.defaults.batchSize
        }

        try {
            const payload = await this.systemSettingsProvider.get<unknown>(FILE_CONTEXT_GATE_SETTINGS_KEY)
            const settingsBatchSize = this.readSettingsBatchSize(payload)
            if (settingsBatchSize !== undefined) {
                return settingsBatchSize
            }
        } catch {
            return this.defaults.batchSize
        }

        return this.defaults.batchSize
    }

    /**
     * Reads batch size from settings payload.
     *
     * @param payload Settings payload.
     * @returns Valid batch size or undefined.
     */
    private readSettingsBatchSize(payload: unknown): number | undefined {
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            return undefined
        }

        return this.readBatchSize((payload as Record<string, unknown>)["batchSize"])
    }

    /**
     * Reads batch size number.
     *
     * @param value Raw value.
     * @returns Valid batch size or undefined.
     */
    private readBatchSize(value: unknown): number | undefined {
        if (
            typeof value !== "number" ||
            !Number.isInteger(value) ||
            value < 1
        ) {
            return undefined
        }

        return value
    }

    /**
     * Builds a set of file paths that have context coverage.
     *
     * @param externalContext External context payload.
     * @returns Set of file paths.
     */
    private resolveContextPaths(externalContext: Readonly<Record<string, unknown>> | null): Set<string> {
        const paths = new Set<string>()
        if (externalContext === null) {
            return paths
        }

        const rawVectorContext = externalContext["vectorContext"]
        if (!Array.isArray(rawVectorContext)) {
            return paths
        }

        for (const entry of rawVectorContext) {
            if (!isPipelineCollectionItem(entry)) {
                continue
            }

            const metadata = readObjectField(entry, "metadata")
            if (metadata === undefined) {
                continue
            }

            const rawPath = metadata["filePath"] ?? metadata["path"]
            if (typeof rawPath !== "string") {
                continue
            }

            const normalizedPath = rawPath.trim()
            if (normalizedPath.length === 0) {
                continue
            }

            paths.add(normalizedPath)
        }

        return paths
    }

    /**
     * Splits files into fixed-size batches.
     *
     * @param files Source files.
     * @param batchSize Batch size.
     * @returns File batches.
     */
    private createBatches(
        files: readonly Readonly<Record<string, unknown>>[],
        batchSize: number,
    ): readonly Readonly<Record<string, unknown>>[][] {
        const batches: Readonly<Record<string, unknown>>[][] = []

        for (let index = 0; index < files.length; index += batchSize) {
            batches.push(files.slice(index, index + batchSize))
        }

        return batches
    }
}
