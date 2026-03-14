import Parser from "tree-sitter"
import Rust from "tree-sitter-rust"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type IAstCallDTO,
    type IAstClassDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type IAstInterfaceDTO,
    type IAstSourceLocationDTO,
    type IParsedSourceFileDTO,
    type ISourceCodeParseRequest,
    type ISourceCodeParser,
    type SupportedLanguage,
} from "@codenautic/core"

import {AST_PARSER_ERROR_CODE, AstParserError} from "./ast-parser.error"

/**
 * Supported rust parser language variants.
 */
export type RustParserLanguage = typeof AST_LANGUAGE.RUST

/**
 * Construction options for rust source parser.
 */
export interface IRustSourceCodeParserOptions {
    /**
     * Canonical language variant exposed by parser.
     */
    readonly language: RustParserLanguage
}

interface IRustTraversalContext {
    readonly functionName?: string
}

interface IRustParsedState {
    readonly imports: IAstImportDTO[]
    readonly interfaces: IAstInterfaceDTO[]
    readonly classes: IAstClassDTO[]
    readonly functions: IAstFunctionDTO[]
    readonly calls: IAstCallDTO[]
    readonly implRelations: Map<string, Set<string>>
}

interface ISyntaxNodePosition {
    readonly row: number
    readonly column: number
}

interface ISyntaxNode {
    readonly type: string
    readonly text: string
    readonly namedChildren: readonly ISyntaxNode[]
    readonly parent: ISyntaxNode | null
    readonly hasError: boolean
    readonly startPosition: ISyntaxNodePosition
    readonly endPosition: ISyntaxNodePosition
}

/**
 * Dedicated tree-sitter parser for rust source files.
 */
export class RustSourceCodeParser implements ISourceCodeParser {
    public readonly language: RustParserLanguage

    private readonly parser: Parser

    /**
     * Creates parser for rust source files.
     *
     * @param options Canonical rust language variant.
     */
    public constructor(options: IRustSourceCodeParserOptions) {
        this.language = options.language
        this.parser = new Parser()
        this.parser.setLanguage(resolveRustGrammar(options.language))
    }

    /**
     * Parses one rust source file into deterministic AST DTOs.
     *
     * @param request Parse request payload.
     * @returns Parsed source-file snapshot.
     * @throws {AstParserError} When request payload is invalid or parser fails.
     */
    public parse(request: ISourceCodeParseRequest): Promise<IParsedSourceFileDTO> {
        const normalizedRequest = normalizeParseRequest(request)

        try {
            const rootNode = this.parser.parse(normalizedRequest.content).rootNode as unknown as ISyntaxNode
            const state = createParsedState()
            this.traverse(rootNode, state, {})
            const classes = mergeImplRelations(state.classes, state.implRelations)

            return Promise.resolve({
                filePath: normalizedRequest.filePath,
                language: this.language,
                hasSyntaxErrors: rootNode.hasError,
                imports: state.imports,
                typeAliases: [],
                interfaces: state.interfaces,
                enums: [],
                classes,
                functions: state.functions,
                calls: state.calls,
            })
        } catch (error) {
            throw new AstParserError(resolveParserFailureMessage(error), {
                code: AST_PARSER_ERROR_CODE.PARSE_FAILED,
                filePath: normalizedRequest.filePath,
            })
        }
    }

    /**
     * Recursively walks rust AST and collects normalized entities.
     *
     * @param node Current syntax node.
     * @param state Mutable parse state.
     * @param context Parent traversal context.
     */
    private traverse(node: ISyntaxNode, state: IRustParsedState, context: IRustTraversalContext): void {
        for (const importEntry of collectImports(node)) {
            state.imports.push(importEntry)
        }

        const interfaceEntry = collectInterface(node)
        if (interfaceEntry !== null) {
            state.interfaces.push(interfaceEntry)
        }

        const classEntry = collectClass(node)
        if (classEntry !== null) {
            state.classes.push(classEntry)
        }

        collectImplRelations(node, state.implRelations)

        const functionEntry = collectFunction(node)
        let nextContext = context
        if (functionEntry !== null) {
            state.functions.push(functionEntry)
            nextContext = {
                ...context,
                functionName: functionEntry.name,
            }
        }

        const callEntry = collectCall(node, nextContext)
        if (callEntry !== null) {
            state.calls.push(callEntry)
        }

        for (const childNode of node.namedChildren) {
            this.traverse(childNode, state, nextContext)
        }
    }
}

/**
 * Resolves tree-sitter grammar module for rust language variant.
 *
 * @param _language Canonical rust language.
 * @returns Tree-sitter grammar module.
 */
function resolveRustGrammar(_language: RustParserLanguage): Parser.Language {
    return Rust as unknown as Parser.Language
}

/**
 * Narrows supported language to rust variant.
 *
 * @param language Canonical supported language.
 * @returns Rust language variant.
 * @throws Error When language is not rust.
 */
export function assertRustParserLanguage(language: SupportedLanguage): RustParserLanguage {
    if (language === AST_LANGUAGE.RUST) {
        return language
    }

    throw new Error(`Unsupported Rust parser language: ${language}`)
}

/**
 * Creates empty mutable parse-state collections.
 *
 * @returns Initialized parse state.
 */
function createParsedState(): IRustParsedState {
    return {
        imports: [],
        interfaces: [],
        classes: [],
        functions: [],
        calls: [],
        implRelations: new Map<string, Set<string>>(),
    }
}

/**
 * Validates parse request payload.
 *
 * @param request Raw parse request.
 * @returns Normalized request.
 * @throws {AstParserError} When request payload is invalid.
 */
function normalizeParseRequest(request: ISourceCodeParseRequest): ISourceCodeParseRequest {
    const filePath = request.filePath.trim()
    if (filePath.length === 0) {
        throw new AstParserError("Source-code parser requires non-empty filePath", {
            code: AST_PARSER_ERROR_CODE.INVALID_FILE_PATH,
        })
    }

    if (typeof request.content !== "string") {
        throw new AstParserError("Source-code parser requires string content", {
            code: AST_PARSER_ERROR_CODE.INVALID_SOURCE_CONTENT,
            filePath,
        })
    }

    return {
        filePath,
        content: request.content,
    }
}

/**
 * Collects rust use declarations and expands grouped imports.
 *
 * @param node Current syntax node.
 * @returns Normalized import DTO list.
 */
function collectImports(node: ISyntaxNode): readonly IAstImportDTO[] {
    if (node.type !== "use_declaration") {
        return []
    }

    const singleImportEntry = collectSingleUseImport(node)
    if (singleImportEntry !== null) {
        return [singleImportEntry]
    }

    const scopedUseList = findFirstNamedChild(node, ["scoped_use_list"])
    if (scopedUseList === undefined) {
        return []
    }

    return collectScopedUseListImports(scopedUseList)
}

/**
 * Collects simple rust `use a::b` import entry.
 *
 * @param node Rust use declaration node.
 * @returns Normalized import entry or `null`.
 */
function collectSingleUseImport(node: ISyntaxNode): IAstImportDTO | null {
    const scopedUseList = findFirstNamedChild(node, ["scoped_use_list"])
    if (scopedUseList !== undefined) {
        return null
    }

    const scopedIdentifier = findFirstNamedChild(node, ["scoped_identifier"])
    const source = readNodeText(scopedIdentifier)
    if (source === undefined) {
        return null
    }

    const localName = source.split("::").at(-1)
    const specifiers = localName !== undefined && localName.length > 0 ? [localName] : []
    return buildImportEntry(source, specifiers, node)
}

/**
 * Collects grouped rust imports from `use foo::{bar, baz}` form.
 *
 * @param scopedUseList Scoped use-list syntax node.
 * @returns Normalized import DTO list.
 */
function collectScopedUseListImports(scopedUseList: ISyntaxNode): readonly IAstImportDTO[] {
    const prefix = readNodeText(findFirstNamedChild(scopedUseList, ["scoped_identifier"]))
    const useListNode = findFirstNamedChild(scopedUseList, ["use_list"])
    if (useListNode === undefined) {
        return []
    }

    const imports: IAstImportDTO[] = []
    for (const child of useListNode.namedChildren) {
        const importEntry = collectScopedUseImportEntry(child, prefix)
        if (importEntry !== null) {
            imports.push(importEntry)
        }
    }

    return imports
}

/**
 * Collects one grouped rust import entry.
 *
 * @param node Grouped use child node.
 * @param prefix Group prefix from `scoped_identifier`.
 * @returns Normalized import entry or `null`.
 */
function collectScopedUseImportEntry(
    node: ISyntaxNode,
    prefix: string | undefined,
): IAstImportDTO | null {
    if (node.type === "identifier") {
        const localName = readNodeText(node)
        if (localName === undefined) {
            return null
        }

        const source = withUsePrefix(prefix, localName)
        return buildImportEntry(source, [localName], node)
    }

    if (node.type === "use_as_clause") {
        return collectUseAliasImport(node, prefix)
    }

    if (node.type === "use_wildcard") {
        const source = prefix !== undefined ? `${prefix}::*` : "*"
        return buildImportEntry(source, ["*"], node)
    }

    return null
}

/**
 * Collects aliased rust import entry from `use path::{source as alias}`.
 *
 * @param node Alias import clause node.
 * @param prefix Group prefix from `scoped_identifier`.
 * @returns Normalized import entry or `null`.
 */
function collectUseAliasImport(node: ISyntaxNode, prefix: string | undefined): IAstImportDTO | null {
    const identifiers = node.namedChildren.filter((namedChild): boolean => {
        return namedChild.type === "identifier"
    })
    const sourceName = readNodeText(identifiers[0])
    const aliasName = readNodeText(identifiers[1])
    if (sourceName === undefined || aliasName === undefined) {
        return null
    }

    const source = withUsePrefix(prefix, sourceName)
    return buildImportEntry(source, [aliasName], node)
}

/**
 * Prefixes grouped rust import path with parent namespace when present.
 *
 * @param prefix Optional group prefix.
 * @param importSource Local import source.
 * @returns Fully qualified import path.
 */
function withUsePrefix(prefix: string | undefined, importSource: string): string {
    if (prefix === undefined) {
        return importSource
    }

    return `${prefix}::${importSource}`
}

/**
 * Collects rust trait declarations as interface DTOs.
 *
 * @param node Current syntax node.
 * @returns Normalized interface DTO or `null`.
 */
function collectInterface(node: ISyntaxNode): IAstInterfaceDTO | null {
    if (node.type !== "trait_item") {
        return null
    }

    const name = readNodeText(findFirstNamedChild(node, ["type_identifier"]))
    if (name === undefined) {
        return null
    }

    return {
        name,
        exported: hasRustPublicVisibility(node),
        extendsTypes: [],
        location: createSourceLocation(node),
    }
}

/**
 * Collects rust struct declarations as class DTOs.
 *
 * @param node Current syntax node.
 * @returns Normalized class DTO or `null`.
 */
function collectClass(node: ISyntaxNode): IAstClassDTO | null {
    if (node.type !== "struct_item") {
        return null
    }

    const name = readNodeText(findFirstNamedChild(node, ["type_identifier"]))
    if (name === undefined) {
        return null
    }

    return {
        name,
        exported: hasRustPublicVisibility(node),
        extendsTypes: [],
        implementsTypes: [],
        location: createSourceLocation(node),
    }
}

/**
 * Collects trait-to-struct implementation relations from impl blocks.
 *
 * @param node Current syntax node.
 * @param implRelations Mutable implementation relation map.
 */
function collectImplRelations(node: ISyntaxNode, implRelations: Map<string, Set<string>>): void {
    if (node.type !== "impl_item") {
        return
    }

    const implTypes = node.namedChildren.filter((child): boolean => {
        return child.type === "type_identifier" || child.type === "scoped_type_identifier"
    })
    if (implTypes.length < 2) {
        return
    }

    const traitName = readNodeText(implTypes[0])
    const targetType = readNodeText(implTypes.at(-1))
    if (traitName === undefined || targetType === undefined) {
        return
    }

    const implementedTraits = implRelations.get(targetType) ?? new Set<string>()
    implementedTraits.add(traitName)
    implRelations.set(targetType, implementedTraits)
}

/**
 * Collects rust functions and methods from item/signature declarations.
 *
 * @param node Current syntax node.
 * @returns Normalized function DTO or `null`.
 */
function collectFunction(node: ISyntaxNode): IAstFunctionDTO | null {
    if (node.type !== "function_item" && node.type !== "function_signature_item") {
        return null
    }

    const name = readNodeText(findFirstNamedChild(node, ["identifier"]))
    if (name === undefined) {
        return null
    }

    const implAncestor = findClosestAncestor(node, "impl_item")
    if (implAncestor !== null) {
        const parentClassName = resolveImplTargetType(implAncestor)
        return {
            name,
            kind: AST_FUNCTION_KIND.METHOD,
            exported: hasRustPublicVisibility(node),
            async: false,
            ...(parentClassName !== undefined ? {parentClassName} : {}),
            location: createSourceLocation(node),
        }
    }

    const traitAncestor = findClosestAncestor(node, "trait_item")
    if (traitAncestor !== null) {
        const parentClassName = readNodeText(findFirstNamedChild(traitAncestor, ["type_identifier"]))
        return {
            name,
            kind: AST_FUNCTION_KIND.METHOD,
            exported: hasRustPublicVisibility(node),
            async: false,
            ...(parentClassName !== undefined ? {parentClassName} : {}),
            location: createSourceLocation(node),
        }
    }

    return {
        name,
        kind: AST_FUNCTION_KIND.FUNCTION,
        exported: hasRustPublicVisibility(node),
        async: false,
        location: createSourceLocation(node),
    }
}

/**
 * Collects rust call and macro invocation expressions.
 *
 * @param node Current syntax node.
 * @param context Parent traversal context.
 * @returns Normalized call DTO or `null`.
 */
function collectCall(node: ISyntaxNode, context: IRustTraversalContext): IAstCallDTO | null {
    if (node.type === "call_expression") {
        const callee = readNodeText(node.namedChildren[0])
        if (callee === undefined) {
            return null
        }

        return {
            callee,
            ...(context.functionName !== undefined ? {caller: context.functionName} : {}),
            location: createSourceLocation(node),
        }
    }

    if (node.type !== "macro_invocation") {
        return null
    }

    const macroName = readNodeText(findFirstNamedChild(node, ["identifier"]))
    if (macroName === undefined) {
        return null
    }

    return {
        callee: macroName,
        ...(context.functionName !== undefined ? {caller: context.functionName} : {}),
        location: createSourceLocation(node),
    }
}

/**
 * Resolves target type name for one rust impl block.
 *
 * @param implNode Impl node.
 * @returns Implemented target type.
 */
function resolveImplTargetType(implNode: ISyntaxNode): string | undefined {
    const implTypes = implNode.namedChildren.filter((child): boolean => {
        return child.type === "type_identifier" || child.type === "scoped_type_identifier"
    })

    return readNodeText(implTypes.at(-1))
}

/**
 * Applies collected impl trait relations onto class DTOs.
 *
 * @param classes Collected class DTOs.
 * @param implRelations Collected impl relations.
 * @returns Class DTOs with merged implements lists.
 */
function mergeImplRelations(
    classes: readonly IAstClassDTO[],
    implRelations: ReadonlyMap<string, ReadonlySet<string>>,
): readonly IAstClassDTO[] {
    return classes.map((classEntry) => {
        const implementedTraits = implRelations.get(classEntry.name)
        if (implementedTraits === undefined || implementedTraits.size === 0) {
            return classEntry
        }

        const implementsTypes = Array.from(implementedTraits.values())
        return {
            ...classEntry,
            implementsTypes,
        }
    })
}

/**
 * Resolves whether rust declaration has explicit `pub` visibility.
 *
 * @param node Declaration node.
 * @returns `true` when declaration starts with `pub`.
 */
function hasRustPublicVisibility(node: ISyntaxNode): boolean {
    return /^\s*pub\b/u.test(node.text)
}

/**
 * Builds normalized import DTO payload.
 *
 * @param source Import source path.
 * @param specifiers Imported local names.
 * @param node Syntax node for location.
 * @returns Import DTO.
 */
function buildImportEntry(
    source: string,
    specifiers: readonly string[],
    node: ISyntaxNode,
): IAstImportDTO {
    return {
        source,
        kind: AST_IMPORT_KIND.STATIC,
        specifiers,
        typeOnly: false,
        location: createSourceLocation(node),
    }
}

/**
 * Finds first direct named child with one of expected node types.
 *
 * @param node Parent syntax node.
 * @param nodeTypes Candidate node types.
 * @returns Matching child or `undefined`.
 */
function findFirstNamedChild(
    node: ISyntaxNode | undefined,
    nodeTypes: readonly string[],
): ISyntaxNode | undefined {
    if (node === undefined) {
        return undefined
    }

    return node.namedChildren.find((child): boolean => {
        return nodeTypes.includes(child.type)
    })
}

/**
 * Reads trimmed syntax-node text.
 *
 * @param node Syntax node.
 * @returns Trimmed text or `undefined`.
 */
function readNodeText(node: ISyntaxNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined
    }

    const trimmed = node.text.trim()
    if (trimmed.length === 0) {
        return undefined
    }

    return trimmed
}

/**
 * Finds closest ancestor with expected node type.
 *
 * @param node Starting syntax node.
 * @param nodeType Ancestor node type.
 * @returns Matching ancestor or `null`.
 */
function findClosestAncestor(node: ISyntaxNode, nodeType: string): ISyntaxNode | null {
    let current = node.parent

    while (current !== null) {
        if (current.type === nodeType) {
            return current
        }

        current = current.parent
    }

    return null
}

/**
 * Builds 1-based source location from tree-sitter node.
 *
 * @param node Syntax node.
 * @returns Normalized source location.
 */
function createSourceLocation(node: ISyntaxNode): IAstSourceLocationDTO {
    return {
        lineStart: node.startPosition.row + 1,
        lineEnd: node.endPosition.row + 1,
        columnStart: node.startPosition.column + 1,
        columnEnd: node.endPosition.column + 1,
    }
}

/**
 * Resolves human-readable parser failure message.
 *
 * @param error Unknown thrown value.
 * @returns Safe error message.
 */
function resolveParserFailureMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Tree-sitter parser failed"
}
