/**
 * Generic anti-corruption layer contract.
 *
 * @template TExternal External payload type.
 * @template TDomain Domain payload type.
 */
export interface IAntiCorruptionLayer<TExternal, TDomain> {
    /**
     * Converts external payload into domain-safe representation.
     *
     * @param external External payload.
     * @returns Domain representation.
     */
    toDomain(external: TExternal): TDomain
}
