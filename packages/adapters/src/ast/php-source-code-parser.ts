import Parser from "tree-sitter"
import PHP from "tree-sitter-php"

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
 * Supported php parser language variants.
 */
export type PhpParserLanguage = typeof AST_LANGUAGE.PHP

/**
 * Construction options for php source parser.
 */
export interface IPhpSourceCodeParserOptions {
    /**
     * Canonical language variant exposed by parser.
     */
    readonly language: PhpParserLanguage
}

interface IPhpGrammarModule {
    readonly php?: Parser.Language
    readonly default?: {
        readonly php?: Parser.Language
    }
    readonly "module.exports"?: {
        readonly php?: Parser.Language
    }
}

interface IPhpTraversalContext {
    readonly className?: string
    readonly functionName?: string
}

interface IPhpParsedState {
    readonly imports: IAstImportDTO[]
    readonly interfaces: IAstInterfaceDTO[]
    readonly classes: IAstClassDTO[]
    readonly functions: IAstFunctionDTO[]
    readonly calls: IAstCallDTO[]
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
 * Dedicated tree-sitter parser for php source files.
 */
export class PhpSourceCodeParser implements ISourceCodeParser {
    public readonly language: PhpParserLanguage

    private readonly parser: Parser

    /**
     * Creates parser for php source files.
     *
     * @param options Canonical php language variant.
     */
    public constructor(options: IPhpSourceCodeParserOptions) {
        this.language = options.language
        this.parser = new Parser()
        this.parser.setLanguage(resolvePhpGrammar(options.language))
    }

    /**
     * Parses one php source file into deterministic AST DTOs.
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

            return Promise.resolve({
                filePath: normalizedRequest.filePath,
                language: this.language,
                hasSyntaxErrors: rootNode.hasError,
                imports: state.imports,
                typeAliases: [],
                interfaces: state.interfaces,
                enums: [],
                classes: state.classes,
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
     * Recursively walks php AST and collects normalized entities.
     *
     * @param node Current syntax node.
     * @param state Mutable parse state.
     * @param context Parent traversal context.
     */
    private traverse(node: ISyntaxNode, state: IPhpParsedState, context: IPhpTraversalContext): void {
        for (const importEntry of collectImports(node)) {
            state.imports.push(importEntry)
        }

        let nextContext = context

        const interfaceEntry = collectInterface(node)
        if (interfaceEntry !== null) {
            state.interfaces.push(interfaceEntry)
            nextContext = {
                ...nextContext,
                className: interfaceEntry.name,
            }
        }

        const classEntry = collectClass(node)
        if (classEntry !== null) {
            state.classes.push(classEntry)
            nextContext = {
                ...nextContext,
                className: classEntry.name,
            }
        }

        const functionEntry = collectFunction(node, nextContext)
        if (functionEntry !== null) {
            state.functions.push(functionEntry)
            nextContext = {
                ...nextContext,
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
 * Resolves tree-sitter grammar module for php language variant.
 *
 * @param _language Canonical php language.
 * @returns Tree-sitter grammar module.
 * @throws Error When grammar export is unavailable.
 */
function resolvePhpGrammar(_language: PhpParserLanguage): Parser.Language {
    const phpModule = PHP as unknown as IPhpGrammarModule
    if (phpModule.php !== undefined) {
        return phpModule.php
    }

    const defaultGrammar = phpModule.default?.php
    if (defaultGrammar !== undefined) {
        return defaultGrammar
    }

    const moduleExportsGrammar = phpModule["module.exports"]?.php
    if (moduleExportsGrammar !== undefined) {
        return moduleExportsGrammar
    }

    throw new Error("tree-sitter-php grammar export is unavailable")
}

/**
 * Narrows supported language to php variant.
 *
 * @param language Canonical supported language.
 * @returns Php language variant.
 * @throws Error When language is not php.
 */
export function assertPhpParserLanguage(language: SupportedLanguage): PhpParserLanguage {
    if (language === AST_LANGUAGE.PHP) {
        return language
    }

    throw new Error(`Unsupported PHP parser language: ${language}`)
}

/**
 * Creates empty mutable parse-state collections.
 *
 * @returns Initialized parse state.
 */
function createParsedState(): IPhpParsedState {
    return {
        imports: [],
        interfaces: [],
        classes: [],
        functions: [],
        calls: [],
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
 * Collects php namespace-use declarations including grouped imports.
 *
 * @param node Current syntax node.
 * @returns Normalized import DTO list.
 */
function collectImports(node: ISyntaxNode): readonly IAstImportDTO[] {
    if (node.type !== "namespace_use_declaration") {
        return []
    }

    const namespacePrefix = readNodeText(findFirstNamedChild(node, ["namespace_name"]))
    const imports: IAstImportDTO[] = []
    const useClauses = collectNamespaceUseClauses(node)
    for (const useClause of useClauses) {
        const importEntry = buildNamespaceUseClauseImport(useClause, namespacePrefix)
        if (importEntry !== null) {
            imports.push(importEntry)
        }
    }

    return imports
}

/**
 * Converts one namespace-use clause to normalized import DTO.
 *
 * @param useClause Namespace-use clause node.
 * @param namespacePrefix Grouped namespace prefix when present.
 * @returns Normalized import DTO or `null`.
 */
function buildNamespaceUseClauseImport(
    useClause: ISyntaxNode,
    namespacePrefix: string | undefined,
): IAstImportDTO | null {
    const source = resolveNamespaceUseClauseSource(useClause, namespacePrefix)
    if (source === undefined) {
        return null
    }

    return {
        source,
        kind: AST_IMPORT_KIND.STATIC,
        specifiers: resolveNamespaceUseClauseSpecifiers(useClause, source),
        typeOnly: false,
        location: createSourceLocation(useClause),
    }
}

/**
 * Resolves fully qualified import source from one namespace-use clause.
 *
 * @param useClause Namespace-use clause node.
 * @param namespacePrefix Grouped namespace prefix when present.
 * @returns Fully qualified source path or `undefined`.
 */
function resolveNamespaceUseClauseSource(
    useClause: ISyntaxNode,
    namespacePrefix: string | undefined,
): string | undefined {
    const sourceNode = findFirstNamedChild(useClause, ["qualified_name", "name"])
    const sourcePath = normalizeNamespaceSegment(readNodeText(sourceNode))
    if (sourcePath === undefined) {
        return undefined
    }

    if (!isGroupedNamespaceUseClause(useClause) || namespacePrefix === undefined) {
        return sourcePath
    }

    return joinNamespacePath(namespacePrefix, sourcePath)
}

/**
 * Resolves local import specifiers from namespace-use clause.
 *
 * @param useClause Namespace-use clause node.
 * @param source Fully resolved source path.
 * @returns Imported local specifier names.
 */
function resolveNamespaceUseClauseSpecifiers(
    useClause: ISyntaxNode,
    source: string,
): readonly string[] {
    const aliasName = resolveNamespaceUseClauseAlias(useClause)
    if (aliasName !== undefined) {
        return [aliasName]
    }

    const importedName = source.split("\\").at(-1)
    if (importedName === undefined || importedName.length === 0) {
        return []
    }

    return [importedName]
}

/**
 * Resolves whether namespace-use clause belongs to grouped use declaration.
 *
 * @param useClause Namespace-use clause node.
 * @returns `true` when clause belongs to namespace-use group.
 */
function isGroupedNamespaceUseClause(useClause: ISyntaxNode): boolean {
    return useClause.parent?.type === "namespace_use_group"
}

/**
 * Collects namespace-use clause nodes from direct or grouped use declarations.
 *
 * @param declaration Namespace-use declaration node.
 * @returns Ordered namespace-use clauses.
 */
function collectNamespaceUseClauses(declaration: ISyntaxNode): readonly ISyntaxNode[] {
    const directClauses = findNamedChildren(declaration, ["namespace_use_clause"])
    if (directClauses.length > 0) {
        return directClauses
    }

    const groupedClauseNode = findFirstNamedChild(declaration, ["namespace_use_group"])
    if (groupedClauseNode === undefined) {
        return []
    }

    return findNamedChildren(groupedClauseNode, ["namespace_use_clause"])
}

/**
 * Resolves alias name from one namespace-use clause when alias is explicitly declared.
 *
 * @param useClause Namespace-use clause node.
 * @returns Alias name or `undefined`.
 */
function resolveNamespaceUseClauseAlias(useClause: ISyntaxNode): string | undefined {
    if (useClause.namedChildren.length < 2) {
        return undefined
    }

    const sourceNode = findFirstNamedChild(useClause, ["qualified_name", "name"])
    if (sourceNode === undefined) {
        return undefined
    }

    const aliasCandidate = useClause.namedChildren.at(-1)
    if (aliasCandidate === undefined || aliasCandidate === sourceNode || aliasCandidate.type !== "name") {
        return undefined
    }

    const sourceName = readNodeText(sourceNode)
    const aliasName = readNodeText(aliasCandidate)
    if (sourceName === undefined || aliasName === undefined || aliasName === sourceName) {
        return undefined
    }

    return aliasName
}

/**
 * Joins namespace prefix and local name to one qualified path.
 *
 * @param prefix Namespace prefix.
 * @param suffix Local namespace segment.
 * @returns Fully qualified namespace path.
 */
function joinNamespacePath(prefix: string, suffix: string): string {
    if (prefix.endsWith("\\")) {
        return `${prefix}${suffix}`
    }

    return `${prefix}\\${suffix}`
}

/**
 * Normalizes namespace text segment by stripping use-kind prefix.
 *
 * @param segment Raw namespace segment.
 * @returns Normalized segment or `undefined`.
 */
function normalizeNamespaceSegment(segment: string | undefined): string | undefined {
    if (segment === undefined) {
        return undefined
    }

    const normalized = segment.replace(/^(function|const)\s+/u, "").trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Collects php interface declarations.
 *
 * @param node Current syntax node.
 * @returns Normalized interface DTO or `null`.
 */
function collectInterface(node: ISyntaxNode): IAstInterfaceDTO | null {
    if (node.type !== "interface_declaration") {
        return null
    }

    const name = readNodeText(findFirstNamedChild(node, ["name"]))
    if (name === undefined) {
        return null
    }

    return {
        name,
        exported: true,
        extendsTypes: collectTypeNames(findFirstNamedChild(node, ["base_clause"])),
        location: createSourceLocation(node),
    }
}

/**
 * Collects php class and trait declarations as class-like DTOs.
 *
 * @param node Current syntax node.
 * @returns Normalized class DTO or `null`.
 */
function collectClass(node: ISyntaxNode): IAstClassDTO | null {
    if (node.type === "trait_declaration") {
        const traitName = readNodeText(findFirstNamedChild(node, ["name"]))
        if (traitName === undefined) {
            return null
        }

        return {
            name: traitName,
            exported: true,
            extendsTypes: [],
            implementsTypes: [],
            location: createSourceLocation(node),
        }
    }

    if (node.type !== "class_declaration") {
        return null
    }

    const className = readNodeText(findFirstNamedChild(node, ["name"]))
    if (className === undefined) {
        return null
    }

    const extendsTypes = collectTypeNames(findFirstNamedChild(node, ["base_clause"]))
    const interfaceTypes = collectTypeNames(findFirstNamedChild(node, ["class_interface_clause"]))
    const traitUsageTypes = collectTraitUsageNames(findFirstNamedChild(node, ["declaration_list"]))

    return {
        name: className,
        exported: true,
        extendsTypes,
        implementsTypes: mergeDistinctTypeNames(interfaceTypes, traitUsageTypes),
        location: createSourceLocation(node),
    }
}

/**
 * Collects function and method declarations from php syntax nodes.
 *
 * @param node Current syntax node.
 * @param context Parent traversal context.
 * @returns Normalized function DTO or `null`.
 */
function collectFunction(
    node: ISyntaxNode,
    context: IPhpTraversalContext,
): IAstFunctionDTO | null {
    if (node.type !== "function_definition" && node.type !== "method_declaration") {
        return null
    }

    const name = readNodeText(findFirstNamedChild(node, ["name"]))
    if (name === undefined) {
        return null
    }

    const isMethod = node.type === "method_declaration"
    return {
        name,
        kind: isMethod ? AST_FUNCTION_KIND.METHOD : AST_FUNCTION_KIND.FUNCTION,
        exported: resolveFunctionExported(node, isMethod),
        async: false,
        ...(isMethod && context.className !== undefined ? {parentClassName: context.className} : {}),
        location: createSourceLocation(node),
    }
}

/**
 * Resolves exported visibility for php function and method declarations.
 *
 * @param node Function-like syntax node.
 * @param isMethod Whether node represents class/interface/trait method.
 * @returns `true` when declaration is exported by parser contract.
 */
function resolveFunctionExported(node: ISyntaxNode, isMethod: boolean): boolean {
    if (!isMethod) {
        return true
    }

    return hasPublicVisibilityModifier(node)
}

/**
 * Resolves whether php node has explicit public visibility modifier.
 *
 * @param node Method declaration node.
 * @returns `true` when node has public visibility.
 */
function hasPublicVisibilityModifier(node: ISyntaxNode): boolean {
    const visibilityModifiers = findNamedChildren(node, ["visibility_modifier"])
    return visibilityModifiers.some((modifier): boolean => {
        return modifier.text.trim() === "public"
    })
}

/**
 * Collects php call expressions from supported call node shapes.
 *
 * @param node Current syntax node.
 * @param context Parent traversal context.
 * @returns Normalized call DTO or `null`.
 */
function collectCall(node: ISyntaxNode, context: IPhpTraversalContext): IAstCallDTO | null {
    if (
        node.type !== "function_call_expression" &&
        node.type !== "member_call_expression" &&
        node.type !== "scoped_call_expression"
    ) {
        return null
    }

    const callee = resolveCallCallee(node)
    if (callee === undefined) {
        return null
    }

    return {
        callee,
        ...(context.functionName !== undefined ? {caller: context.functionName} : {}),
        location: createSourceLocation(node),
    }
}

/**
 * Resolves call-site callee text from supported php call nodes.
 *
 * @param node Call expression syntax node.
 * @returns Normalized callee text or `undefined`.
 */
function resolveCallCallee(node: ISyntaxNode): string | undefined {
    if (node.type === "function_call_expression") {
        return resolveFunctionCallCallee(node)
    }

    if (node.type === "member_call_expression") {
        return resolveMemberCallCallee(node)
    }

    if (node.type === "scoped_call_expression") {
        return resolveScopedCallCallee(node)
    }

    return undefined
}

/**
 * Resolves callee text from direct function call expression.
 *
 * @param node Function call syntax node.
 * @returns Normalized callee text or `undefined`.
 */
function resolveFunctionCallCallee(node: ISyntaxNode): string | undefined {
    const callTarget = findFirstNamedChild(node, ["name", "qualified_name", "variable_name"])
    return readNodeText(callTarget)
}

/**
 * Resolves callee text from member call expression.
 *
 * @param node Member call syntax node.
 * @returns Normalized callee text or `undefined`.
 */
function resolveMemberCallCallee(node: ISyntaxNode): string | undefined {
    const objectTarget = readNodeText(
        findFirstNamedChild(node, ["variable_name", "name", "qualified_name"]),
    )
    const methodTarget = readNodeText(findFirstNamedChild(node, ["name"]))
    if (objectTarget === undefined || methodTarget === undefined) {
        return undefined
    }

    return `${objectTarget}->${methodTarget}`
}

/**
 * Resolves callee text from static/scoped call expression.
 *
 * @param node Scoped call syntax node.
 * @returns Normalized callee text or `undefined`.
 */
function resolveScopedCallCallee(node: ISyntaxNode): string | undefined {
    const scopeTarget = readNodeText(
        findFirstNamedChild(node, ["relative_scope", "name", "qualified_name"]),
    )
    const methodNames = findNamedChildren(node, ["name"])
    const methodTarget = readNodeText(methodNames.at(-1))
    if (scopeTarget === undefined || methodTarget === undefined) {
        return undefined
    }

    return `${scopeTarget}::${methodTarget}`
}

/**
 * Collects referenced type names from one node.
 *
 * @param node Node containing type-name children.
 * @returns Ordered type names.
 */
function collectTypeNames(node: ISyntaxNode | undefined): readonly string[] {
    if (node === undefined) {
        return []
    }

    const typeNames: string[] = []
    const candidateNodes = findNamedChildren(node, ["name", "qualified_name"])
    for (const candidateNode of candidateNodes) {
        const candidateName = readNodeText(candidateNode)
        pushUnique(typeNames, candidateName)
    }

    return typeNames
}

/**
 * Collects trait names declared in php class use declarations.
 *
 * @param declarationListNode Class declaration list node.
 * @returns Unique trait names used by class.
 */
function collectTraitUsageNames(declarationListNode: ISyntaxNode | undefined): readonly string[] {
    if (declarationListNode === undefined) {
        return []
    }

    const traitNames: string[] = []
    const useDeclarations = findNamedChildren(declarationListNode, ["use_declaration"])
    for (const useDeclaration of useDeclarations) {
        const usedTypes = findNamedChildren(useDeclaration, ["name", "qualified_name"])
        for (const usedType of usedTypes) {
            pushUnique(traitNames, readNodeText(usedType))
        }
    }

    return traitNames
}

/**
 * Merges two ordered type lists without duplicates.
 *
 * @param primary Primary type list.
 * @param secondary Secondary type list.
 * @returns Ordered distinct type names.
 */
function mergeDistinctTypeNames(
    primary: readonly string[],
    secondary: readonly string[],
): readonly string[] {
    const result: string[] = []
    for (const item of primary) {
        pushUnique(result, item)
    }
    for (const item of secondary) {
        pushUnique(result, item)
    }
    return result
}

/**
 * Pushes string value to array only when non-empty and unique.
 *
 * @param target Target mutable array.
 * @param value Candidate value.
 */
function pushUnique(target: string[], value: string | undefined): void {
    if (value === undefined || value.length === 0 || target.includes(value)) {
        return
    }

    target.push(value)
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
 * Finds all direct named children matching any candidate node types.
 *
 * @param node Parent syntax node.
 * @param nodeTypes Candidate node types.
 * @returns Ordered matching children.
 */
function findNamedChildren(node: ISyntaxNode, nodeTypes: readonly string[]): readonly ISyntaxNode[] {
    return node.namedChildren.filter((child): boolean => {
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
 * Resolves human-readable parser failure message.
 *
 * @param error Unknown thrown value.
 * @returns Stable error message.
 */
function resolveParserFailureMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown parser failure"
}
