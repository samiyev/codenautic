import type { IScanProgressEvent } from "@/lib/api/endpoints/scan-progress.endpoint"

import type { ScanProgressCollection } from "../collections/scan-progress-collection"

/**
 * Создаёт ISO timestamp со смещением от текущего времени.
 *
 * @param offsetSeconds - Смещение в секундах (отрицательное = прошлое).
 * @returns ISO 8601 строка.
 */
function createRelativeIsoTime(offsetSeconds: number): string {
    const timestamp = Date.now() + offsetSeconds * 1000
    return new Date(timestamp).toISOString()
}

/**
 * Начальные события прогресса для demo jobId.
 */
const DEFAULT_EVENTS: ReadonlyArray<IScanProgressEvent> = [
    {
        etaSeconds: 240,
        log: "Подготовка пайплайна сканирования",
        message: "Проверка доступа к репозиторию",
        phase: "queue",
        percent: 5,
        phaseCompleted: false,
        timestamp: createRelativeIsoTime(-90),
    },
    {
        etaSeconds: 180,
        log: "Получен репозиторий, запуск загрузки",
        message: "Клонирование репозитория",
        phase: "clone",
        percent: 18,
        phaseCompleted: false,
        timestamp: createRelativeIsoTime(-70),
    },
    {
        etaSeconds: 120,
        log: "Найдены все целевые файлы",
        message: "Сборка графа зависимостей",
        phase: "analysis",
        percent: 42,
        phaseCompleted: false,
        timestamp: createRelativeIsoTime(-45),
    },
    {
        etaSeconds: 60,
        log: "Создан список правил и приоритетов",
        message: "Индексация",
        phase: "indexing",
        percent: 74,
        phaseCompleted: false,
        timestamp: createRelativeIsoTime(-20),
    },
]

/**
 * Заполняет scan progress коллекцию начальным набором данных.
 *
 * @param collection - Коллекция scan progress для заполнения.
 */
export function seedScanProgress(collection: ScanProgressCollection): void {
    collection.seed([
        {
            jobId: "scan-job-local",
            events: DEFAULT_EVENTS,
        },
    ])
}
