import type { Key, Selection } from "@heroui/react"

/**
 * Создаёт обработчик изменения scope-фильтра для HeroUI Select.
 * Устраняет дублирование идентичной логики извлечения значения из Selection.
 *
 * @param callback Callback для обновления scope-значения.
 * @returns Обработчик onSelectionChange для HeroUI Select.
 */
export function createScopeChangeHandler<T extends string>(
    callback: (value: T) => void,
): (keys: Selection) => void {
    return (keys: Selection): void => {
        if (keys === "all") {
            return
        }
        const next: IteratorResult<Key> = keys.values().next()
        if (next.done === true) {
            return
        }
        callback(next.value as T)
    }
}
