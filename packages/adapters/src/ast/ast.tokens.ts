import {
    createToken,
    type ICodeChunkEmbeddingGenerator,
    type ICodeGraphPageRankService,
    type IGraphRepository,
    type ISourceCodeParser,
} from "@codenautic/core"

/**
 * DI tokens for AST adapter domain.
 */
export const AST_TOKENS = {
    CodeChunkEmbeddingGenerator: createToken<ICodeChunkEmbeddingGenerator>(
        "adapters.ast.code-chunk-embedding-generator",
    ),
    GraphRepository: createToken<IGraphRepository>("adapters.ast.graph-repository"),
    PageRankService: createToken<ICodeGraphPageRankService>("adapters.ast.page-rank-service"),
    SourceCodeParser: createToken<ISourceCodeParser>("adapters.ast.source-code-parser"),
} as const

