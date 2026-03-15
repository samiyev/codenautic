import { AuthCollection } from "./collections/auth-collection"
import { CodeCityCollection } from "./collections/code-city-collection"
import { ContractValidationCollection } from "./collections/contract-validation-collection"
import { DashboardCollection } from "./collections/dashboard-collection"
import { ProvidersCollection } from "./collections/providers-collection"
import { RepositoriesCollection } from "./collections/repositories-collection"
import { ReviewsCollection } from "./collections/reviews-collection"
import { RulesCollection } from "./collections/rules-collection"
import { SettingsCollection } from "./collections/settings-collection"

/**
 * Централизованное in-memory хранилище для mock API слоя MSW.
 *
 * Агрегирует все коллекции данных (auth, settings, rules, providers, reviews).
 * Предоставляет единую точку сброса состояния через метод reset().
 */
export class MockStore {
    /**
     * Коллекция авторизации: пользователи и сессии.
     */
    public readonly auth: AuthCollection

    /**
     * Коллекция contract validation: blueprint, guardrails, drift, граф архитектуры.
     */
    public readonly contractValidation: ContractValidationCollection

    /**
     * Коллекция dashboard: метрики, распределения, активность, flow, токены, очередь, таймлайн.
     */
    public readonly dashboard: DashboardCollection

    /**
     * Коллекция настроек: пользовательские настройки, предпочтения, конфигурации репозиториев.
     */
    public readonly settings: SettingsCollection

    /**
     * Коллекция custom-правил пайплайна.
     */
    public readonly rules: RulesCollection

    /**
     * Коллекция Git providers и context sources.
     */
    public readonly providers: ProvidersCollection

    /**
     * Коллекция reviews: CCR, диффы, треды, результаты code review.
     */
    public readonly reviews: ReviewsCollection

    /**
     * Коллекция репозиториев и их overview-профилей.
     */
    public readonly repositories: RepositoriesCollection

    /**
     * Коллекция CodeCity: профили, граф зависимостей.
     */
    public readonly codeCity: CodeCityCollection

    /**
     * Создаёт новый экземпляр MockStore с пустыми коллекциями.
     */
    public constructor() {
        this.auth = new AuthCollection()
        this.contractValidation = new ContractValidationCollection()
        this.dashboard = new DashboardCollection()
        this.settings = new SettingsCollection()
        this.rules = new RulesCollection()
        this.providers = new ProvidersCollection()
        this.reviews = new ReviewsCollection()
        this.repositories = new RepositoriesCollection()
        this.codeCity = new CodeCityCollection()
    }

    /**
     * Сбрасывает все коллекции в начальное пустое состояние.
     */
    public reset(): void {
        this.auth.clear()
        this.contractValidation.clear()
        this.dashboard.clear()
        this.settings.clear()
        this.rules.clear()
        this.providers.clear()
        this.reviews.clear()
        this.repositories.clear()
        this.codeCity.clear()
    }
}
