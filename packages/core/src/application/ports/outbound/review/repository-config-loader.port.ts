import type {IReviewConfigDTO} from "../../../dto/review/review-config.dto"

/**
 * Outbound contract for layered review configuration loading.
 */
export interface IRepositoryConfigLoader {
    /**
     * Loads global default review configuration layer.
     *
     * @returns Partial default config or null when absent.
     */
    loadDefault(): Promise<Partial<IReviewConfigDTO> | null>

    /**
     * Loads organization/team-level configuration layer.
     *
     * @param organizationId Organization identifier.
     * @param teamId Team identifier.
     * @returns Partial organization layer config or null.
     */
    loadOrganization(
        organizationId: string,
        teamId: string,
    ): Promise<Partial<IReviewConfigDTO> | null>

    /**
     * Loads repository-level configuration layer.
     *
     * @param repositoryId Repository identifier.
     * @returns Partial repository layer config or null.
     */
    loadRepository(repositoryId: string): Promise<Partial<IReviewConfigDTO> | null>
}
