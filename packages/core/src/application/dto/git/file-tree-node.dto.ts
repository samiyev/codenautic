/**
 * Supported file tree node types.
 */
export const FILE_TREE_NODE_TYPE = {
    BLOB: "blob",
    TREE: "tree",
} as const

/**
 * File tree node type literal.
 */
export type FileTreeNodeType =
    (typeof FILE_TREE_NODE_TYPE)[keyof typeof FILE_TREE_NODE_TYPE]

/**
 * File tree item in a repository branch/commit snapshot.
 */
export interface IFileTreeNode {
    readonly path: string
    readonly type: FileTreeNodeType
    readonly size: number
    readonly sha: string
}
