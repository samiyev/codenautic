import {describe, expect, test} from "bun:test"

import {FILE_TREE_NODE_TYPE} from "../../../../src/application/dto/git"
import type {IFileTreeNode} from "../../../../src/application/dto/git"

describe("IFileTreeNode", () => {
    test("поддерживает blob узлы", () => {
        const fileNode: IFileTreeNode = {
            path: "src/index.ts",
            type: FILE_TREE_NODE_TYPE.BLOB,
            size: 1234,
            sha: "a1b2c3",
        }

        expect(fileNode.type).toBe("blob")
        expect(fileNode.size).toBe(1234)
    })

    test("поддерживает tree узлы", () => {
        const treeNode: IFileTreeNode = {
            path: "src",
            type: FILE_TREE_NODE_TYPE.TREE,
            size: 0,
            sha: "tree-sha",
        }

        expect(treeNode.path).toBe("src")
        expect(treeNode.type).toBe("tree")
    })
})
