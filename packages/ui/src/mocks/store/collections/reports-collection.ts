import type {
    IReport,
    IReportSectionDistribution,
    IReportTrendPoint,
} from "@/lib/api/endpoints/reports.endpoint"

/**
 * Данные для seed-инициализации ReportsCollection.
 */
export interface IReportsSeedData {
    /**
     * Начальный набор отчётов.
     */
    readonly reports: ReadonlyArray<IReport>
    /**
     * Точки тренда для viewer-графика.
     */
    readonly trends: ReadonlyArray<IReportTrendPoint>
    /**
     * Распределение по секциям для viewer-графика.
     */
    readonly distribution: ReadonlyArray<IReportSectionDistribution>
}

/**
 * Коллекция отчётов для mock API.
 *
 * Хранит in-memory CRUD-операции над отчётами,
 * а также данные трендов и распределений для viewer.
 */
export class ReportsCollection {
    /**
     * Хранилище отчётов по ID.
     */
    private reports: Map<string, IReport> = new Map()

    /**
     * Точки тренда для графиков.
     */
    private trends: ReadonlyArray<IReportTrendPoint> = []

    /**
     * Распределение по секциям.
     */
    private distribution: ReadonlyArray<IReportSectionDistribution> = []

    /**
     * Возвращает список всех отчётов.
     *
     * @returns Массив всех отчётов.
     */
    public listReports(): ReadonlyArray<IReport> {
        return Array.from(this.reports.values())
    }

    /**
     * Возвращает отчёт по идентификатору.
     *
     * @param id - Идентификатор отчёта.
     * @returns Отчёт или undefined, если не найден.
     */
    public getReportById(id: string): IReport | undefined {
        return this.reports.get(id)
    }

    /**
     * Добавляет новый отчёт в коллекцию.
     *
     * @param report - Отчёт для добавления.
     */
    public addReport(report: IReport): void {
        this.reports.set(report.id, report)
    }

    /**
     * Удаляет отчёт по идентификатору.
     *
     * @param id - Идентификатор отчёта.
     * @returns true если отчёт был найден и удалён.
     */
    public deleteReport(id: string): boolean {
        return this.reports.delete(id)
    }

    /**
     * Возвращает точки тренда для viewer-графика.
     *
     * @returns Массив точек тренда.
     */
    public getTrends(): ReadonlyArray<IReportTrendPoint> {
        return this.trends
    }

    /**
     * Возвращает распределение по секциям для viewer-графика.
     *
     * @returns Массив распределений.
     */
    public getDistribution(): ReadonlyArray<IReportSectionDistribution> {
        return this.distribution
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * Очищает текущее состояние и загружает переданные данные.
     *
     * @param data - Данные для seed-инициализации.
     */
    public seed(data: IReportsSeedData): void {
        this.clear()

        for (const report of data.reports) {
            this.reports.set(report.id, report)
        }

        this.trends = data.trends
        this.distribution = data.distribution
    }

    /**
     * Полностью очищает коллекцию.
     */
    public clear(): void {
        this.reports.clear()
        this.trends = []
        this.distribution = []
    }
}
