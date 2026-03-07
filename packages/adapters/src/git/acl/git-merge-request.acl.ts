import type {IAntiCorruptionLayer, IMergeRequestDTO, IMergeRequestDiffFileDTO} from "@codenautic/core"

import {mapExternalDiffFiles, mapExternalMergeRequest, type IExternalGitMergeRequest} from "./git-acl-mapper"

/**
 * Git merge request ACL implementation.
 */
export class GitMergeRequestAcl
    implements IAntiCorruptionLayer<IExternalGitMergeRequest, IMergeRequestDTO>
{
    /**
     * Creates git merge request ACL instance.
     */
    public constructor() {}

    /**
     * Converts provider merge request payload to shared domain DTO.
     *
     * @param external Provider payload.
     * @returns Domain merge request DTO.
     */
    public toDomain(external: IExternalGitMergeRequest): IMergeRequestDTO {
        return mapExternalMergeRequest(external)
    }
}

/**
 * Git diff files ACL implementation.
 */
export class GitDiffFilesAcl implements IAntiCorruptionLayer<unknown, readonly IMergeRequestDiffFileDTO[]> {
    /**
     * Creates git diff files ACL instance.
     */
    public constructor() {}

    /**
     * Converts provider diff payload to shared domain DTO list.
     *
     * @param external Provider payload.
     * @returns Domain diff files.
     */
    public toDomain(external: unknown): readonly IMergeRequestDiffFileDTO[] {
        return mapExternalDiffFiles(external)
    }
}
