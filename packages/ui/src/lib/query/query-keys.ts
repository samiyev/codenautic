/**
 * Единый factory для React Query ключей.
 */
export const queryKeys = {
    system: {
        health: (): readonly ["system", "health"] => ["system", "health"] as const,
    },
}
