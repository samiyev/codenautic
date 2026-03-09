/**
 * Granular source-file languages supported by AST parsers.
 */
export const AST_LANGUAGE = {
    TYPESCRIPT: "typescript",
    TSX: "tsx",
    JAVASCRIPT: "javascript",
    JSX: "jsx",
    PYTHON: "python",
    GO: "go",
    JAVA: "java",
    CSHARP: "csharp",
    RUBY: "ruby",
    RUST: "rust",
    PHP: "php",
    KOTLIN: "kotlin",
} as const

/**
 * Fine-grained language literal used by AST parser adapters.
 */
export type SupportedLanguage =
    (typeof AST_LANGUAGE)[keyof typeof AST_LANGUAGE]

/**
 * Supported import kinds collected during AST traversal.
 */
export const AST_IMPORT_KIND = {
    STATIC: "static",
    REQUIRE: "require",
    DYNAMIC: "dynamic",
    EXPORT_FROM: "export-from",
} as const

/**
 * Import kind literal.
 */
export type AstImportKind =
    (typeof AST_IMPORT_KIND)[keyof typeof AST_IMPORT_KIND]

/**
 * Supported function kinds collected during AST traversal.
 */
export const AST_FUNCTION_KIND = {
    FUNCTION: "function",
    METHOD: "method",
} as const

/**
 * Function kind literal.
 */
export type AstFunctionKind =
    (typeof AST_FUNCTION_KIND)[keyof typeof AST_FUNCTION_KIND]

/**
 * 1-based source-code location for parsed AST nodes.
 */
export interface IAstSourceLocationDTO {
    /**
     * Start line number.
     */
    readonly lineStart: number

    /**
     * End line number.
     */
    readonly lineEnd: number

    /**
     * Start column number.
     */
    readonly columnStart: number

    /**
     * End column number.
     */
    readonly columnEnd: number
}

/**
 * Normalized import statement payload.
 */
export interface IAstImportDTO {
    /**
     * Imported module specifier.
     */
    readonly source: string

    /**
     * Import statement kind.
     */
    readonly kind: AstImportKind

    /**
     * Imported or re-exported symbol names.
     */
    readonly specifiers: readonly string[]

    /**
     * Whether statement is type-only when source language supports it.
     */
    readonly typeOnly: boolean

    /**
     * Source location for import statement.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Normalized type-alias declaration payload.
 */
export interface IAstTypeAliasDTO {
    /**
     * Type alias identifier.
     */
    readonly name: string

    /**
     * Whether declaration is exported.
     */
    readonly exported: boolean

    /**
     * Source location for type alias.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Normalized interface declaration payload.
 */
export interface IAstInterfaceDTO {
    /**
     * Interface identifier.
     */
    readonly name: string

    /**
     * Whether declaration is exported.
     */
    readonly exported: boolean

    /**
     * Parent interfaces listed in extends clause.
     */
    readonly extendsTypes: readonly string[]

    /**
     * Source location for interface.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Normalized enum declaration payload.
 */
export interface IAstEnumDTO {
    /**
     * Enum identifier.
     */
    readonly name: string

    /**
     * Whether declaration is exported.
     */
    readonly exported: boolean

    /**
     * Enum member names.
     */
    readonly members: readonly string[]

    /**
     * Source location for enum.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Normalized class declaration payload.
 */
export interface IAstClassDTO {
    /**
     * Class identifier.
     */
    readonly name: string

    /**
     * Whether declaration is exported.
     */
    readonly exported: boolean

    /**
     * Parent classes from extends clauses.
     */
    readonly extendsTypes: readonly string[]

    /**
     * Implemented contracts from implements clauses.
     */
    readonly implementsTypes: readonly string[]

    /**
     * Source location for class.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Normalized function or method declaration payload.
 */
export interface IAstFunctionDTO {
    /**
     * Function or method identifier.
     */
    readonly name: string

    /**
     * Function shape.
     */
    readonly kind: AstFunctionKind

    /**
     * Whether declaration is exported.
     */
    readonly exported: boolean

    /**
     * Whether function is async.
     */
    readonly async: boolean

    /**
     * Owning class name for methods.
     */
    readonly parentClassName?: string

    /**
     * Source location for function or method.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Normalized call-site payload.
 */
export interface IAstCallDTO {
    /**
     * Called function or method expression.
     */
    readonly callee: string

    /**
     * Enclosing function or method name when available.
     */
    readonly caller?: string

    /**
     * Source location for call expression.
     */
    readonly location: IAstSourceLocationDTO
}

/**
 * Deterministic AST snapshot for a single source file.
 */
export interface IParsedSourceFileDTO {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Fine-grained language used for parsing.
     */
    readonly language: SupportedLanguage

    /**
     * Whether parser detected syntax errors in the produced tree.
     */
    readonly hasSyntaxErrors: boolean

    /**
     * Static, dynamic, and require-based imports.
     */
    readonly imports: readonly IAstImportDTO[]

    /**
     * Type aliases collected from the file.
     */
    readonly typeAliases: readonly IAstTypeAliasDTO[]

    /**
     * Interfaces collected from the file.
     */
    readonly interfaces: readonly IAstInterfaceDTO[]

    /**
     * Enums collected from the file.
     */
    readonly enums: readonly IAstEnumDTO[]

    /**
     * Classes collected from the file.
     */
    readonly classes: readonly IAstClassDTO[]

    /**
     * Functions and methods collected from the file.
     */
    readonly functions: readonly IAstFunctionDTO[]

    /**
     * Call expressions collected from the file.
     */
    readonly calls: readonly IAstCallDTO[]
}
