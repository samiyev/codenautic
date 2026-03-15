/**
 * Опция для select-поля.
 */
export interface IFormSelectOption {
    /** Значение опции. */
    readonly value: string
    /** Лейбл опции. */
    readonly label: string
    /** Дополнительный подпоясняющий текст. */
    readonly description?: string
    /** Блокирован ли выбор пункта. */
    readonly isDisabled?: boolean
}

