import {describe, expect, test} from "bun:test"

import {TokenUsageRecord} from "../../../../../src/domain/value-objects/token-usage-record.value-object"
import type {
    IAnalyticsAggregationBucket,
    IAnalyticsCcrMetrics,
    IAnalyticsAggregatedMetrics,
    IAnalyticsDoraMetrics,
    INormalizedAnalyticsAggregationQuery,
} from "../../../../../src/application/dto/analytics/analytics-aggregation.dto"
import type {IAnalyticsService} from "../../../../../src/application/ports/outbound/analytics/analytics-service.port"

const createDoraMetrics = (): IAnalyticsDoraMetrics => {
    return {
        deployFrequency: 8,
        changeFailRate: 0.2,
        leadTime: 1200,
        meanTimeToRestore: 60,
        timeRange: {
            from: "2026-03-03T00:00:00.000Z",
            to: "2026-03-04T00:00:00.000Z",
        },
    }
}

const createAggregation = (): IAnalyticsAggregatedMetrics => {
    const bucket: IAnalyticsAggregationBucket = {
        groupId: "org-1",
        groupLabel: "Org 1",
        dora: createDoraMetrics(),
    }

    return {
        groupBy: "org",
        timeRange: {
            from: "2026-03-03T00:00:00.000Z",
            to: "2026-03-04T00:00:00.000Z",
        },
        buckets: [bucket],
    }
}

class InMemoryAnalyticsService implements IAnalyticsService {
    public readonly aggregateCalls: INormalizedAnalyticsAggregationQuery[] = []
    public readonly trackCalls: string[] = []
    public readonly doraCalls: string[] = []
    public readonly ccrCalls: string[] = []

    public track(record: TokenUsageRecord): Promise<void> {
        this.trackCalls.push(record.model)
        return Promise.resolve()
    }

    public aggregate(query: INormalizedAnalyticsAggregationQuery): Promise<IAnalyticsAggregatedMetrics> {
        this.aggregateCalls.push(query)
        return Promise.resolve(createAggregation())
    }

    public getDORA(
        organizationId: string,
        _from: Date,
        _to: Date,
    ): Promise<IAnalyticsDoraMetrics | null> {
        this.doraCalls.push(organizationId)
        return Promise.resolve(createDoraMetrics())
    }

    public getCCRMetrics(
        repositoryId: string,
        _from: Date,
        _to: Date,
    ): Promise<IAnalyticsCcrMetrics | null> {
        this.ccrCalls.push(repositoryId)
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

describe("IAnalyticsService contract", () => {
    test("поддерживает агрегацию запросов", async () => {
        const service = new InMemoryAnalyticsService()
        const query: INormalizedAnalyticsAggregationQuery = {
            groupBy: "org",
            timeRange: {
                from: new Date("2026-03-03T00:00:00.000Z"),
                to: new Date("2026-03-04T00:00:00.000Z"),
            },
        }
        const result = await service.aggregate(query)

        expect(service.aggregateCalls).toHaveLength(1)
        expect(service.aggregateCalls[0]).toBe(query)
        expect(result.groupBy).toBe("org")
        expect(result.buckets).toHaveLength(1)
        expect(result.buckets[0]?.groupId).toBe("org-1")
    })

    test("поддерживает трекинг и отдельные метрики по domain-функциям", async () => {
        const service = new InMemoryAnalyticsService()
        await service.track(TokenUsageRecord.create({
            model: "gpt-4o",
            provider: "openai",
            input: 100,
            output: 200,
            outputReasoning: 20,
            total: 320,
            organizationId: "org-1",
            teamId: "team-1",
            byok: true,
            recordedAt: new Date("2026-03-03T00:00:00.000Z"),
            developerId: "dev-1",
            ccrNumber: "ccr-42",
        }))

        const dora = await service.getDORA("org-1", new Date("2026-03-03T00:00:00.000Z"), new Date("2026-03-04T00:00:00.000Z"))
        const ccr = await service.getCCRMetrics("repo-1", new Date("2026-03-03T00:00:00.000Z"), new Date("2026-03-04T00:00:00.000Z"))

        expect(service.trackCalls).toEqual(["gpt-4o"])
        expect(service.doraCalls).toEqual(["org-1"])
        expect(service.ccrCalls).toEqual(["repo-1"])
        expect(dora?.deployFrequency).toBe(8)
        expect(ccr?.repositoryId).toBe("repo-1")
    })
})
