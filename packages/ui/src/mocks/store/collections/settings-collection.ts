import type { IRepoConfig } from "@/lib/api/endpoints/repo-config.endpoint"

/**
 * Коллекция настроек: пользовательские настройки, предпочтения и конфигурации репозиториев.
 *
 * Хранит in-memory данные для mock API слоя MSW.
 * Поддерживает key-value операции над настройками и предпочтениями,
 * а также CRUD-операции над конфигурациями репозиториев.
 */
export class SettingsCollection {
    /**
     * Пользовательские настройки (тема, локаль и т.д.).
     */
    private userSettings: Record<string, unknown> = {}

    /**
     * Пользовательские предпочтения (уведомления, дайджест и т.д.).
     */
    private userPreferences: Record<string, unknown> = {}

    /**
     * Конфигурации репозиториев по ID.
     */
    private repoConfigs: Map<string, IRepoConfig> = new Map()

    /**
     * Возвращает текущие пользовательские настройки.
     *
     * @returns Неизменяемая копия пользовательских настроек.
     */
    public getUserSettings(): Readonly<Record<string, unknown>> {
        return { ...this.userSettings }
    }

    /**
     * Частично обновляет пользовательские настройки (merge).
     *
     * @param patch - Объект с полями для обновления.
     */
    public updateUserSettings(patch: Record<string, unknown>): void {
        this.userSettings = { ...this.userSettings, ...patch }
    }

    /**
     * Полностью заменяет пользовательские настройки.
     *
     * @param data - Новый набор настроек.
     */
    public replaceUserSettings(data: Record<string, unknown>): void {
        this.userSettings = { ...data }
    }

    /**
     * Возвращает текущие пользовательские предпочтения.
     *
     * @returns Неизменяемая копия пользовательских предпочтений.
     */
    public getUserPreferences(): Readonly<Record<string, unknown>> {
        return { ...this.userPreferences }
    }

    /**
     * Частично обновляет пользовательские предпочтения (merge).
     *
     * @param patch - Объект с полями для обновления.
     */
    public updateUserPreferences(patch: Record<string, unknown>): void {
        this.userPreferences = { ...this.userPreferences, ...patch }
    }

    /**
     * Полностью заменяет пользовательские предпочтения.
     *
     * @param data - Новый набор предпочтений.
     */
    public replaceUserPreferences(data: Record<string, unknown>): void {
        this.userPreferences = { ...data }
    }

    /**
     * Возвращает конфигурацию репозитория по ID.
     *
     * @param repoId - Идентификатор репозитория.
     * @returns Конфигурация или undefined, если не найдена.
     */
    public getRepoConfig(repoId: string): IRepoConfig | undefined {
        return this.repoConfigs.get(repoId)
    }

    /**
     * Устанавливает или обновляет конфигурацию репозитория.
     *
     * @param repoId - Идентификатор репозитория.
     * @param config - Конфигурация для сохранения.
     */
    public setRepoConfig(repoId: string, config: IRepoConfig): void {
        this.repoConfigs.set(repoId, config)
    }

    /**
     * Заполняет коллекцию значениями по умолчанию.
     *
     * Очищает текущее состояние и устанавливает дефолтные настройки,
     * предпочтения и конфигурации репозиториев.
     */
    public seed(): void {
        this.clear()

        this.userSettings = {
            theme: "system",
            locale: "en",
            updatedAtMs: "2026-03-02T00:00:00.000Z",
        }

        this.userPreferences = {
            notifications: true,
            emailDigest: "weekly",
            updatedAtMs: "2026-03-02T00:00:00.000Z",
        }

        this.repoConfigs.set("repo-1", {
            repositoryId: "repo-1",
            configYaml: "version: 1\nrules:\n  max-complexity: 10\n",
            ignorePatterns: ["node_modules/", "dist/", "*.min.js"],
            reviewMode: "AUTO",
            updatedAt: "2026-03-02T00:00:00.000Z",
        })
    }

    /**
     * Полностью очищает коллекцию: настройки, предпочтения, конфигурации репозиториев.
     */
    public clear(): void {
        this.userSettings = {}
        this.userPreferences = {}
        this.repoConfigs.clear()
    }
}
