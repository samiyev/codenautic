import type { ICodeCityTreemapFileDescriptor } from "@/components/codecity/codecity-treemap"

import type { IDriftAlertChannelOption } from "./contract-validation-types"

/**
 * Available notification channel options for drift alert configuration UI.
 */
export const DRIFT_ALERT_CHANNEL_OPTIONS: ReadonlyArray<IDriftAlertChannelOption> = [
    {
        id: "slack",
        label: "Slack",
    },
    {
        id: "email",
        label: "Email",
    },
    {
        id: "teams",
        label: "Teams",
    },
    {
        id: "webhook",
        label: "Webhook",
    },
]

/**
 * Mapping from file path to a stable file id for drift overlay treemap.
 */
export const DRIFT_FILE_ID_BY_PATH: Readonly<Record<string, string>> = {
    "src/infrastructure/http/review.controller.ts": "drift-file-review-controller",
    "src/domain/review.aggregate.ts": "drift-file-review-aggregate",
    "src/application/use-cases/review-merge-request.use-case.ts": "drift-file-review-usecase",
    "src/infrastructure/repository/review.repository.ts": "drift-file-review-repository",
    "src/infrastructure/messaging/review.events.ts": "drift-file-review-events",
    "src/domain/entities/review.ts": "drift-file-review-entity",
    "src/domain/value-objects/risk-score.ts": "drift-file-risk-score",
    "src/adapters/git/gitlab-client.ts": "drift-file-gitlab-client",
}

/**
 * File descriptors for the drift overlay CodeCity treemap.
 */
export const DRIFT_CODE_CITY_FILES: ReadonlyArray<ICodeCityTreemapFileDescriptor> = [
    {
        complexity: 28,
        coverage: 62,
        id: "drift-file-review-controller",
        issueCount: 5,
        loc: 240,
        path: "src/infrastructure/http/review.controller.ts",
    },
    {
        complexity: 31,
        coverage: 71,
        id: "drift-file-review-aggregate",
        issueCount: 4,
        loc: 212,
        path: "src/domain/review.aggregate.ts",
    },
    {
        complexity: 37,
        coverage: 58,
        id: "drift-file-review-usecase",
        issueCount: 6,
        loc: 298,
        path: "src/application/use-cases/review-merge-request.use-case.ts",
    },
    {
        complexity: 29,
        coverage: 64,
        id: "drift-file-review-repository",
        issueCount: 5,
        loc: 250,
        path: "src/infrastructure/repository/review.repository.ts",
    },
    {
        complexity: 24,
        coverage: 66,
        id: "drift-file-review-events",
        issueCount: 4,
        loc: 172,
        path: "src/infrastructure/messaging/review.events.ts",
    },
    {
        complexity: 22,
        coverage: 78,
        id: "drift-file-review-entity",
        issueCount: 3,
        loc: 166,
        path: "src/domain/entities/review.ts",
    },
    {
        complexity: 16,
        coverage: 84,
        id: "drift-file-risk-score",
        issueCount: 2,
        loc: 118,
        path: "src/domain/value-objects/risk-score.ts",
    },
    {
        complexity: 18,
        coverage: 74,
        id: "drift-file-gitlab-client",
        issueCount: 1,
        loc: 186,
        path: "src/adapters/git/gitlab-client.ts",
    },
]
