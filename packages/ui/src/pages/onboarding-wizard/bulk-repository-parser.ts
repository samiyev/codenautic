import type {
    IBulkRepositoryParseIssue,
    IParsedBulkRepositoryList,
} from "./onboarding-wizard-types"

/**
 * Проверяет, является ли строка корректным URL репозитория (http/https).
 *
 * @param value Строка для проверки.
 * @returns true если URL валиден и использует http(s) протокол.
 */
function isValidRepositoryUrl(value: string): boolean {
    try {
        const parsed = new URL(value)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

/**
 * Разбирает многострочный текст в список валидных URL репозиториев.
 *
 * Дедуплицирует (case-insensitive), фильтрует пустые строки
 * и собирает информацию о некорректных записях.
 *
 * @param value Многострочная строка с URL.
 * @returns Нормализованный список репозиториев и проблемные строки.
 */
export function parseBulkRepositoryList(value: string): IParsedBulkRepositoryList {
    const lines = value.split(/\r?\n/)
    const repositories: string[] = []
    const invalidLines: IBulkRepositoryParseIssue[] = []
    const seen = new Set<string>()

    for (let index = 0; index < lines.length; index += 1) {
        const candidate = lines[index]?.trim() ?? ""
        if (candidate.length === 0) {
            continue
        }

        if (isValidRepositoryUrl(candidate) === false) {
            invalidLines.push({ line: index + 1, value: candidate })
            continue
        }

        const normalized = candidate.toLowerCase()
        if (seen.has(normalized) === true) {
            continue
        }

        seen.add(normalized)
        repositories.push(candidate)
    }

    return { repositories, invalidLines }
}
