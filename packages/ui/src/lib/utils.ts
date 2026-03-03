import {clsx, type ClassValue} from "clsx"
import {twMerge} from "tailwind-merge"

/**
 * Объединяет CSS-классы с дедупликацией Tailwind-утилит.
 *
 * @param values - классы для объединения
 * @returns итоговая строка классов
 */
export function cn(...values: ClassValue[]): string {
    return twMerge(clsx(values))
}
