import {describe, expect, test} from "bun:test"

import {ValidationError} from "../../../../src/domain/errors/validation.error"
import {AnalyticsAggregationUseCase} from "../../../../src/application/use-cases/analytics/analytics-aggregation.use-case"
import type {
    IAnalyticsAggregatedMetrics,
    IAnalyticsCcrMetrics,
    IAnalyticsDoraMetrics,
    INormalizedAnalyticsAggregationQuery,
} from "../../../../src/application/dto/analytics/analytics-aggregation.dto"
import {ANALYTICS_GROUP_BY} from "../../../../src/application/dto/analytics/analytics-aggregation.dto"
import type {IAnalyticsService} from "../../../../src/application/ports/outbound/analytics/analytics-service.port"

class InMemoryAnalyticsService implements IAnalyticsService {
    public readonly aggregateCalls: INormalizedAnalyticsAggregationQuery[] = []
    public readonly trackedModels: string[] = []
    public readonly doraCalls: Array<{
        readonly organizationId: string
        readonly from: Date
        readonly to: Date
    }> = []
    public readonly ccrCalls: Array<{
        readonly repositoryId: string
        readonly from: Date
        readonly to: Date
    }> = []

    public track(record: Parameters<IAnalyticsService["track"]>[0]): Promise<void> {
        this.trackedModels.push(record.model)
        return Promise.resolve()
    }

    public aggregate(
        query: INormalizedAnalyticsAggregationQuery,
    ): Promise<IAnalyticsAggregatedMetrics> {
        this.aggregateCalls.push(query)
        return Promise.resolve({
            groupBy: query.groupBy,
            timeRange: {
                from: "2026-03-03T00:00:00.000Z",
                to: "2026-03-04T00:00:00.000Z",
            },
            buckets: [{
                groupId: "org-1",
                groupLabel: "Org 1",
                dora: {
                    deployFrequency: 5,
                    changeFailRate: 0.1,
                    leadTime: 3600,
                    meanTimeToRestore: 120,
                    timeRange: {
                        from: "2026-03-03T00:00:00.000Z",
                        to: "2026-03-04T00:00:00.000Z",
                    },
                },
            }],
        })
    }

    public getDORA(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<IAnalyticsDoraMetrics | null> {
        this.doraCalls.push({organizationId, from, to})
        return Promise.resolve({
            deployFrequency: 8,
            changeFailRate: 0.2,
            leadTime: 1200,
            meanTimeToRestore: 60,
            timeRange: {
                from: from.toISOString(),
                to: to.toISOString(),
            },
        })
    }

    public getCCRMetrics(
        repositoryId: string,
        from: Date,
        to: Date,
    ): Promise<IAnalyticsCcrMetrics | null> {
        this.ccrCalls.push({repositoryId, from, to})
        return Promise.resolve({
            cycleTime: 300,
            reviewTime: 120,
            size: 100,
            commentsCount: 3,
            iterationsCount: 2,
            firstResponseTime: 45,
            repositoryId,
        })
    }
}

describe("AnalyticsAggregationUseCase", () => {
    test("нормализует входные значения и возвращает агрегированные метрики", async () => {
        const service = new InMemoryAnalyticsService()
        const useCase = new AnalyticsAggregationUseCase({analyticsService: service})

        const result = await useCase.execute({
            timeRange: {
                from: "2026-03-03T00:00:00.000Z",
                to: "2026-03-04T00:00:00.000Z",
            },
            organizationId: " org-1 ",
            teamId: " team-1 ",
            groupBy: ANALYTICS_GROUP_BY.TEAM,
            repositoryId: " repo-1 ",
        })

        expect(result.isOk).toBe(true)
        expect(result.value.groupBy).toBe(ANALYTICS_GROUP_BY.TEAM)
        expect(result.value.buckets[0]?.groupId).toBe("org-1")

        expect(service.aggregateCalls).toHaveLength(1)
        const query = service.aggregateCalls[0]
        expect(query).toBeDefined()
        expect(query?.groupBy).toBe(ANALYTICS_GROUP_BY.TEAM)
        expect(query?.teamId).toBe("team-1")
        expect(query?.organizationId).toBe("org-1")
        expect(query?.repositoryId).toBe("repo-1")
        expect(query?.timeRange.from.toISOString()).toBe("2026-03-03T00:00:00.000Z")
        expect(query?.timeRange.to.toISOString()).toBe("2026-03-04T00:00:00.000Z")
    })

    test("применяет дефолтный groupBy=org и собирает ошибки валидации", async () => {
        const service = new InMemoryAnalyticsService()
        const useCase = new AnalyticsAggregationUseCase({analyticsService: service})

        const result = await useCase.execute({
            timeRange: {
                from: "not-a-date",
                to: "2026-03-03T00:00:00.000Z",
            },
            groupBy: ANALYTICS_GROUP_BY.TEAM,
        })

        expect(result.isFail).toBe(true)
        const error = result.error as ValidationError
        expect(error.code).toBe("VALIDATION_ERROR")
        expect(error.fields).toEqual([
            {
                field: "timeRange.from",
                message: "must be a valid ISO date string",
            },
            {
                field: "teamId",
                message: "must be a non-empty string when groupBy is team",
            },
        ])
        expect(service.aggregateCalls).toHaveLength(0)
    })

    test("валидирует порядок дат timeRange и ошибки team/developer/model", async () => {
        const useCase = new AnalyticsAggregationUseCase({
            analyticsService: new InMemoryAnalyticsService(),
        })

        const result = await useCase.execute({
            timeRange: {
                from: "2026-03-04T00:00:00.000Z",
                to: "2026-03-03T00:00:00.000Z",
            },
            groupBy: ANALYTICS_GROUP_BY.DEVELOPER,
            developerId: "",
        })

        expect(result.isFail).toBe(true)
        const error = result.error as ValidationError
        expect(error.code).toBe("VALIDATION_ERROR")
        expect(error.fields).toEqual([{
            field: "timeRange",
            message: "timeRange.from must be before or equal to timeRange.to",
        }, {
            field: "developerId",
            message: "must be a non-empty string when groupBy is developer",
        }])
    })

    test("возвращает ошибку при падении аналитического сервиса", async () => {
        class FailingAnalyticsService extends InMemoryAnalyticsService {
            public override aggregate(
                _query: INormalizedAnalyticsAggregationQuery,
            ): Promise<IAnalyticsAggregatedMetrics> {
                return Promise.reject(
                    new Error("aggregate backend unavailable"),
                )
            }
        }

        const useCase = new AnalyticsAggregationUseCase({
            analyticsService: new FailingAnalyticsService(),
        })

        const result = await useCase.execute({
            timeRange: {
                from: "2026-03-03T00:00:00.000Z",
                to: "2026-03-03T00:00:00.000Z",
            },
            groupBy: ANALYTICS_GROUP_BY.ORG,
        })

        expect(result.isFail).toBe(true)
        const error = result.error as ValidationError
        expect(error.code).toBe("VALIDATION_ERROR")
        expect(error.fields).toEqual([{
            field: "analyticsService",
            message: "aggregate backend unavailable",
        }])
    })
})
