import Parser from "tree-sitter"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    type AstImportKind,
    type IAstCallDTO,
    type IAstClassDTO,
    type IAstEnumDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type IAstInterfaceDTO,
    type IAstSourceLocationDTO,
    type IAstTypeAliasDTO,
    type IParsedSourceFileDTO,
    type ISourceCodeParseRequest,
    type ISourceCodeParser,
    type SupportedLanguage,
} from "@codenautic/core"

import {AST_PARSER_ERROR_CODE, AstParserError} from "./ast-parser.error"

type ISyntaxNode = Parser.SyntaxNode

type ITraversalContext = {
    readonly className?: string
    readonly functionName?: string
}

type ITraversalFrame = {
    readonly node: ISyntaxNode
    readonly context: ITraversalContext
}

type IParsedSourceFileState = {
    readonly imports: IAstImportDTO[]
    readonly typeAliases: IAstTypeAliasDTO[]
    readonly interfaces: IAstInterfaceDTO[]
    readonly enums: IAstEnumDTO[]
    readonly classes: IAstClassDTO[]
    readonly functions: IAstFunctionDTO[]
    readonly calls: IAstCallDTO[]
}

/**
 * Dependencies required by base tree-sitter parser.
 */
export interface IBaseParserOptions {
    /**
     * Fine-grained language supported by parser instance.
     */
    readonly language: SupportedLanguage

    /**
     * Preconfigured tree-sitter parser.
     */
    readonly parser: Parser
}

/**
 * Shared base parser that walks tree-sitter AST exactly once and collects normalized DTOs.
 */
export abstract class BaseParser implements ISourceCodeParser {
    /**
     * Fine-grained language supported by parser instance.
     */
    public readonly language: SupportedLanguage

    private readonly parser: Parser

    /**
     * Creates reusable base parser.
     *
     * @param options Parser language and configured tree-sitter instance.
     */
    protected constructor(options: IBaseParserOptions) {
        this.language = options.language
        this.parser = options.parser
    }

    /**
     * Parses one source file and returns deterministic AST snapshot.
     *
     * @param request Parse request payload.
     * @returns Parsed source-file DTO.
     * @throws {AstParserError} When input or tree-sitter parse fails.
     */
    public parse(request: ISourceCodeParseRequest): Promise<IParsedSourceFileDTO> {
        try {
            const normalizedRequest = normalizeParseRequest(request)
            const rootNode = this.parser.parse(normalizedRequest.content).rootNode

            const state = createParsedSourceFileState()
            this.traverse(rootNode, state)

            return Promise.resolve({
                filePath: normalizedRequest.filePath,
                language: this.language,
                hasSyntaxErrors: rootNode.hasError,
                imports: state.imports,
                typeAliases: state.typeAliases,
                interfaces: state.interfaces,
                enums: state.enums,
                classes: state.classes,
                functions: state.functions,
                calls: state.calls,
            })
        } catch (error) {
            if (error instanceof AstParserError) {
                return Promise.reject(error)
            }

            return Promise.reject(
                new AstParserError(resolveParserFailureMessage(error), {
                    code: AST_PARSER_ERROR_CODE.PARSE_FAILED,
                    filePath: request.filePath.trim(),
                }),
            )
        }
    }

    /**
     * Hook for subclasses/tests that want to observe visited nodes.
     *
     * @param _node Currently visited syntax node.
     */
    protected onNodeVisited(_node: ISyntaxNode): void {
        return undefined
    }

    /**
     * Traverses AST iteratively and collects normalized payloads in one pass.
     *
     * @param rootNode Root syntax node.
     * @param state Mutable collection state.
     */
    private traverse(rootNode: ISyntaxNode, state: IParsedSourceFileState): void {
        const stack: ITraversalFrame[] = [{node: rootNode, context: {}}]

        while (stack.length > 0) {
            const frame = stack.pop()
            if (frame === undefined) {
                continue
            }

            this.onNodeVisited(frame.node)
            const nextContext = this.collectNode(frame.node, frame.context, state)

            for (let index = frame.node.namedChildren.length - 1; index >= 0; index -= 1) {
                const child = frame.node.namedChildren[index]
                if (child !== undefined) {
                    stack.push({node: child, context: nextContext})
                }
            }
        }
    }

    /**
     * Collects node payloads and updates traversal context.
     *
     * @param node Current syntax node.
     * @param context Parent traversal context.
     * @param state Mutable collection state.
     * @returns Context propagated to named children.
     */
    private collectNode(
        node: ISyntaxNode,
        context: ITraversalContext,
        state: IParsedSourceFileState,
    ): ITraversalContext {
        let nextContext = context

        const importEntry = this.collectImport(node)
        if (importEntry !== null) {
            state.imports.push(importEntry)
        }

        const typeAlias = this.collectTypeAlias(node)
        if (typeAlias !== null) {
            state.typeAliases.push(typeAlias)
        }

        const interfaceEntry = this.collectInterface(node)
        if (interfaceEntry !== null) {
            state.interfaces.push(interfaceEntry)
        }

        const enumEntry = this.collectEnum(node)
        if (enumEntry !== null) {
            state.enums.push(enumEntry)
        }

        const classEntry = this.collectClass(node)
        if (classEntry !== null) {
            state.classes.push(classEntry)
            nextContext = {
                ...nextContext,
                className: classEntry.name,
            }
        }

        const functionEntry = this.collectFunction(node, nextContext)
        if (functionEntry !== null) {
            state.functions.push(functionEntry)
            nextContext = {
                ...nextContext,
                functionName: functionEntry.name,
            }
        }

        const callEntry = this.collectCall(node, nextContext)
        if (callEntry !== null) {
            state.calls.push(callEntry)
        }

        return nextContext
    }

    /**
     * Collects import-like statements from one syntax node.
     *
     * @param node Current syntax node.
     * @returns Normalized import DTO or `null`.
     */
    private collectImport(node: ISyntaxNode): IAstImportDTO | null {
        if (node.type === "import_statement") {
            const pythonImport = readPythonImportStatement(node)
            if (pythonImport !== null) {
                return {
                    source: pythonImport.source,
                    kind: AST_IMPORT_KIND.STATIC,
                    specifiers: pythonImport.specifiers,
                    typeOnly: false,
                    location: createSourceLocation(node),
                }
            }

            const sourceNode = findFirstNamedChild(node, ["string"])
            const source = readStringNodeValue(sourceNode)
            if (source === undefined) {
                return null
            }

            return {
                source,
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: collectImportSpecifiers(node),
                typeOnly: /^\s*import\s+type\b/.test(node.text),
                location: createSourceLocation(node),
            }
        }

        if (node.type === "export_statement") {
            const sourceNode = findFirstNamedChild(node, ["string"])
            const source = readStringNodeValue(sourceNode)
            if (source === undefined) {
                return null
            }

            return {
                source,
                kind: AST_IMPORT_KIND.EXPORT_FROM,
                specifiers: collectExportSpecifiers(node),
                typeOnly: /^\s*export\s+type\b/.test(node.text),
                location: createSourceLocation(node),
            }
        }

        if (node.type === "import_from_statement") {
            const sourceNode = findFirstNamedChild(node, ["dotted_name", "relative_import"])
            const source = readNodeText(sourceNode)
            if (source === undefined) {
                return null
            }

            return {
                source,
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: collectImportSpecifiers(node),
                typeOnly: false,
                location: createSourceLocation(node),
            }
        }

        if (node.type !== "call_expression") {
            return null
        }

        const importSource = readImportLikeCallSource(node)
        if (importSource === null) {
            return null
        }

        return {
            source: importSource.source,
            kind: importSource.kind,
            specifiers: [],
            typeOnly: false,
            location: createSourceLocation(node),
        }
    }

    /**
     * Collects type aliases from one syntax node.
     *
     * @param node Current syntax node.
     * @returns Normalized type-alias DTO or `null`.
     */
    private collectTypeAlias(node: ISyntaxNode): IAstTypeAliasDTO | null {
        if (node.type !== "type_alias_declaration") {
            return null
        }

        const nameNode = findFirstNamedChild(node, ["type_identifier", "identifier"])
        const name = readNodeText(nameNode)
        if (name === undefined) {
            return null
        }

        return {
            name,
            exported: isExportedNode(node),
            location: createSourceLocation(node),
        }
    }

    /**
     * Collects interfaces from one syntax node.
     *
     * @param node Current syntax node.
     * @returns Normalized interface DTO or `null`.
     */
    private collectInterface(node: ISyntaxNode): IAstInterfaceDTO | null {
        if (node.type !== "interface_declaration") {
            return null
        }

        const nameNode = findFirstNamedChild(node, ["type_identifier", "identifier"])
        const extendsClause = findFirstNamedChild(node, ["extends_type_clause"])
        const name = readNodeText(nameNode)
        if (name === undefined) {
            return null
        }

        return {
            name,
            exported: isExportedNode(node),
            extendsTypes: splitClauseValues(extendsClause?.text, "extends"),
            location: createSourceLocation(node),
        }
    }

    /**
     * Collects enums from one syntax node.
     *
     * @param node Current syntax node.
     * @returns Normalized enum DTO or `null`.
     */
    private collectEnum(node: ISyntaxNode): IAstEnumDTO | null {
        if (node.type !== "enum_declaration") {
            return null
        }

        const nameNode = findFirstNamedChild(node, ["identifier", "type_identifier"])
        const enumBody = findFirstNamedChild(node, ["enum_body"])
        const name = readNodeText(nameNode)
        if (name === undefined) {
            return null
        }

        return {
            name,
            exported: isExportedNode(node),
            members: collectEnumMembers(enumBody),
            location: createSourceLocation(node),
        }
    }

    /**
     * Collects classes from one syntax node.
     *
     * @param node Current syntax node.
     * @returns Normalized class DTO or `null`.
     */
    private collectClass(node: ISyntaxNode): IAstClassDTO | null {
        if (node.type === "class_definition") {
            const nameNode = findFirstNamedChild(node, ["identifier"])
            const argumentList = findFirstNamedChild(node, ["argument_list"])
            const name = readNodeText(nameNode) ?? "(anonymous class)"

            return {
                name,
                exported: false,
                extendsTypes: collectPythonClassBaseTypes(argumentList),
                implementsTypes: [],
                location: createSourceLocation(node),
            }
        }

        if (node.type !== "class_declaration" && node.type !== "class") {
            return null
        }

        const nameNode = findFirstNamedChild(node, ["type_identifier", "identifier"])
        const heritageNode = findFirstNamedChild(node, ["class_heritage"])
        const extendsClause = findFirstNamedChild(heritageNode, ["extends_clause"])
        const implementsClause = findFirstNamedChild(heritageNode, ["implements_clause"])
        const name = readNodeText(nameNode) ?? "(anonymous class)"

        return {
            name,
            exported: isExportedNode(node),
            extendsTypes: splitClauseValues(
                extendsClause?.text ?? heritageNode?.text,
                "extends",
            ),
            implementsTypes: splitClauseValues(implementsClause?.text, "implements"),
            location: createSourceLocation(node),
        }
    }

    /**
     * Collects functions and methods from one syntax node.
     *
     * @param node Current syntax node.
     * @param context Parent traversal context.
     * @returns Normalized function DTO or `null`.
     */
    private collectFunction(
        node: ISyntaxNode,
        context: ITraversalContext,
    ): IAstFunctionDTO | null {
        if (!isFunctionLikeNode(node)) {
            return null
        }

        const name = resolveFunctionName(node)
        if (name === undefined) {
            return null
        }

        const isMethod = isMethodNode(node)
        return {
            name,
            kind: isMethod ? AST_FUNCTION_KIND.METHOD : AST_FUNCTION_KIND.FUNCTION,
            exported: isExportedNode(node),
            async: isAsyncFunctionNode(node),
            ...(isMethod && context.className !== undefined
                ? {parentClassName: context.className}
                : {}),
            location: createSourceLocation(node),
        }
    }

    /**
     * Collects call expressions from one syntax node.
     *
     * @param node Current syntax node.
     * @param context Parent traversal context.
     * @returns Normalized call DTO or `null`.
     */
    private collectCall(node: ISyntaxNode, context: ITraversalContext): IAstCallDTO | null {
        if (node.type !== "call_expression" && node.type !== "call") {
            return null
        }

        if (node.type === "call_expression" && readImportLikeCallSource(node) !== null) {
            return null
        }

        const calleeNode = node.namedChildren[0]
        const callee = readNodeText(calleeNode)
        if (callee === undefined) {
            return null
        }

        return {
            callee,
            ...(context.functionName !== undefined ? {caller: context.functionName} : {}),
            location: createSourceLocation(node),
        }
    }
}

/**
 * Creates empty mutable collection state.
 *
 * @returns Initialized parser state.
 */
function createParsedSourceFileState(): IParsedSourceFileState {
    return {
        imports: [],
        typeAliases: [],
        interfaces: [],
        enums: [],
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
 * @throws {AstParserError} When request is invalid.
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
 * Reads string-literal value from syntax node.
 *
 * @param node String syntax node.
 * @returns Unquoted string value or `undefined`.
 */
function readStringNodeValue(node: ISyntaxNode | undefined): string | undefined {
    const text = readNodeText(node)
    if (text === undefined) {
        return undefined
    }

    if (text.length >= 2) {
        const first = text[0]
        const last = text[text.length - 1]
        if ((first === '"' || first === "'") && last === first) {
            return text.slice(1, -1)
        }
    }

    return text
}

/**
 * Resolves whether syntax node is exported by surrounding export statement.
 *
 * @param node Syntax node.
 * @returns `true` when node lives under export statement.
 */
function isExportedNode(node: ISyntaxNode): boolean {
    const parent = node.parent
    if (parent === null) {
        return false
    }

    if (parent.type === "export_statement") {
        return true
    }

    if (parent.type === "variable_declarator") {
        return isExportedNode(parent)
    }

    if (parent.type === "lexical_declaration" || parent.type === "variable_declaration") {
        return parent.parent?.type === "export_statement"
    }

    return false
}

/**
 * Resolves whether syntax node represents async function shape.
 *
 * @param node Syntax node.
 * @returns `true` when node begins with async keyword.
 */
function isAsyncFunctionNode(node: ISyntaxNode): boolean {
    return /^\s*async\b/.test(node.text)
}

/**
 * Resolves whether syntax node represents supported function-like declaration.
 *
 * @param node Syntax node.
 * @returns `true` for functions and methods collected by base parser.
 */
function isFunctionLikeNode(node: ISyntaxNode): boolean {
    return (
        node.type === "function_declaration" ||
        node.type === "function_expression" ||
        node.type === "arrow_function" ||
        node.type === "method_definition" ||
        node.type === "function_definition"
    )
}

/**
 * Resolves whether syntax node should be treated as class-bound method.
 *
 * @param node Function-like syntax node.
 * @returns `true` when node represents a method declaration.
 */
function isMethodNode(node: ISyntaxNode): boolean {
    if (node.type === "method_definition") {
        return true
    }

    if (node.type !== "function_definition") {
        return false
    }

    const parent = node.parent
    if (parent === null || parent.type !== "block") {
        return false
    }

    return parent.parent?.type === "class_definition"
}

/**
 * Resolves deterministic function name from supported syntax node.
 *
 * @param node Function-like syntax node.
 * @returns Stable function name or `undefined`.
 */
function resolveFunctionName(node: ISyntaxNode): string | undefined {
    if (node.type === "method_definition") {
        return readNodeText(
            findFirstNamedChild(node, ["property_identifier", "private_property_identifier"]),
        )
    }

    if (node.type === "function_expression" || node.type === "arrow_function") {
        const variableDeclarator = findClosestAncestor(node, "variable_declarator")
        if (variableDeclarator !== null) {
            const variableName = readNodeText(findFirstNamedChild(variableDeclarator, ["identifier"]))
            if (variableName !== undefined) {
                return variableName
            }
        }
    }

    const identifierNode = findFirstNamedChild(node, ["identifier", "property_identifier"])
    if (identifierNode !== undefined) {
        return readNodeText(identifierNode)
    }

    const variableDeclarator = findClosestAncestor(node, "variable_declarator")
    if (variableDeclarator !== null) {
        return readNodeText(findFirstNamedChild(variableDeclarator, ["identifier"]))
    }

    return undefined
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
 * Collects imported binding names from import statement.
 *
 * @param node Import statement node.
 * @returns Imported local specifiers.
 */
function collectImportSpecifiers(node: ISyntaxNode): readonly string[] {
    if (node.type === "import_from_statement") {
        return collectPythonFromImportSpecifiers(node)
    }

    const importClause = findFirstNamedChild(node, ["import_clause"])
    if (importClause !== undefined) {
        const specifiers: string[] = []
        for (const child of importClause.namedChildren) {
            if (child.type === "identifier") {
                pushUnique(specifiers, child.text.trim())
                continue
            }

            if (child.type === "named_imports") {
                for (const importSpecifier of child.namedChildren) {
                    const identifiers = importSpecifier.namedChildren.filter((namedChild): boolean => {
                        return namedChild.type === "identifier"
                    })
                    const localIdentifier = identifiers.at(-1)
                    pushUnique(specifiers, localIdentifier?.text.trim())
                }
                continue
            }

            if (child.type === "namespace_import") {
                const localIdentifier = findFirstNamedChild(child, ["identifier"])
                pushUnique(specifiers, localIdentifier?.text.trim())
            }
        }

        return specifiers
    }

    return collectPythonImportSpecifiers(node)
}

/**
 * Collects exported binding names from export-from statement.
 *
 * @param node Export statement node.
 * @returns Re-exported specifiers.
 */
function collectExportSpecifiers(node: ISyntaxNode): readonly string[] {
    const exportClause = findFirstNamedChild(node, ["export_clause"])
    if (exportClause === undefined) {
        return []
    }

    const specifiers: string[] = []
    for (const child of exportClause.namedChildren) {
        if (child.type !== "export_specifier" && child.type !== "identifier") {
            continue
        }

        if (child.type === "identifier") {
            pushUnique(specifiers, child.text.trim())
            continue
        }

        const identifiers = child.namedChildren.filter((namedChild): boolean => {
            return namedChild.type === "identifier"
        })
        const exportedIdentifier = identifiers.at(-1)
        pushUnique(specifiers, exportedIdentifier?.text.trim())
    }

    return specifiers
}

/**
 * Reads python import statement source and local specifiers.
 *
 * @param node Import statement node.
 * @returns Python import payload or `null` for non-python forms.
 */
function readPythonImportStatement(
    node: ISyntaxNode,
): {readonly source: string; readonly specifiers: readonly string[]} | null {
    if (node.type !== "import_statement") {
        return null
    }

    const firstImportNode = node.namedChildren[0]
    if (firstImportNode === undefined) {
        return null
    }

    const source = readPythonImportSource(firstImportNode)
    if (source === undefined) {
        return null
    }

    return {
        source,
        specifiers: collectPythonImportSpecifiers(node),
    }
}

/**
 * Resolves source module for one python import statement entry.
 *
 * @param node Python import entry.
 * @returns Source module name or `undefined`.
 */
function readPythonImportSource(node: ISyntaxNode): string | undefined {
    if (node.type === "dotted_name" || node.type === "relative_import") {
        return readNodeText(node)
    }

    if (node.type === "aliased_import") {
        return readNodeText(findFirstNamedChild(node, ["dotted_name"]))
    }

    return undefined
}

/**
 * Collects local specifiers from python import statement.
 *
 * @param node Import statement node.
 * @returns Imported local names.
 */
function collectPythonImportSpecifiers(node: ISyntaxNode): readonly string[] {
    if (node.type !== "import_statement") {
        return []
    }

    const specifiers: string[] = []
    for (const child of node.namedChildren) {
        if (child.type === "dotted_name" || child.type === "relative_import") {
            pushUnique(specifiers, readPythonLocalName(child))
            continue
        }

        if (child.type === "aliased_import") {
            const aliasNode = findFirstNamedChild(child, ["identifier"])
            const alias = readNodeText(aliasNode)
            if (alias !== undefined) {
                pushUnique(specifiers, alias)
                continue
            }

            const sourceNode = findFirstNamedChild(child, ["dotted_name"])
            pushUnique(specifiers, readPythonLocalName(sourceNode))
        }
    }

    return specifiers
}

/**
 * Collects local specifiers from python import-from statement.
 *
 * @param node Import-from statement node.
 * @returns Imported local names.
 */
function collectPythonFromImportSpecifiers(node: ISyntaxNode): readonly string[] {
    if (node.type !== "import_from_statement") {
        return []
    }

    const sourceNode = findFirstNamedChild(node, ["dotted_name", "relative_import"])
    const specifiers: string[] = []
    for (const child of node.namedChildren) {
        if (child === sourceNode) {
            continue
        }

        if (child.type === "wildcard_import") {
            pushUnique(specifiers, "*")
            continue
        }

        if (child.type === "dotted_name" || child.type === "relative_import") {
            pushUnique(specifiers, readPythonLocalName(child))
            continue
        }

        if (child.type === "aliased_import") {
            const aliasNode = findFirstNamedChild(child, ["identifier"])
            const alias = readNodeText(aliasNode)
            if (alias !== undefined) {
                pushUnique(specifiers, alias)
                continue
            }

            const importedNode = findFirstNamedChild(child, ["dotted_name"])
            pushUnique(specifiers, readPythonLocalName(importedNode))
        }
    }

    return specifiers
}

/**
 * Resolves python local symbol name from one import entry.
 *
 * @param node Python import node.
 * @returns Local symbol name or `undefined`.
 */
function readPythonLocalName(node: ISyntaxNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined
    }

    const identifierNodes = node.namedChildren.filter((child): boolean => {
        return child.type === "identifier"
    })
    const localIdentifier = identifierNodes.at(-1)
    const localName = readNodeText(localIdentifier)
    if (localName !== undefined) {
        return localName
    }

    const nestedDottedName = findFirstNamedChild(node, ["dotted_name"])
    if (nestedDottedName !== undefined) {
        return readPythonLocalName(nestedDottedName)
    }

    return readNodeText(node)
}

/**
 * Reads source information for require/import call expressions.
 *
 * @param node Call-expression node.
 * @returns Import source descriptor or `null`.
 */
function readImportLikeCallSource(
    node: ISyntaxNode,
): {readonly source: string; readonly kind: AstImportKind} | null {
    const calleeNode = node.namedChildren[0]
    if (calleeNode === undefined) {
        return null
    }

    if (calleeNode.type === "identifier" && calleeNode.text === "require") {
        return readImportSourceFromArguments(node, AST_IMPORT_KIND.REQUIRE)
    }

    if (calleeNode.type === "import") {
        return readImportSourceFromArguments(node, AST_IMPORT_KIND.DYNAMIC)
    }

    return null
}

/**
 * Reads import source from call-expression arguments.
 *
 * @param node Call-expression node.
 * @param kind Normalized import kind.
 * @returns Import source descriptor or `null`.
 */
function readImportSourceFromArguments(
    node: ISyntaxNode,
    kind: AstImportKind,
): {readonly source: string; readonly kind: AstImportKind} | null {
    const argumentsNode = findFirstNamedChild(node, ["arguments"])
    const sourceNode = findFirstNamedChild(argumentsNode, ["string"])
    const source = readStringNodeValue(sourceNode)
    if (source === undefined) {
        return null
    }

    return {source, kind}
}

/**
 * Collects python base classes from class argument list.
 *
 * @param argumentList Class argument list node.
 * @returns Base class names.
 */
function collectPythonClassBaseTypes(argumentList: ISyntaxNode | undefined): readonly string[] {
    if (argumentList === undefined) {
        return []
    }

    const baseTypes: string[] = []
    for (const child of argumentList.namedChildren) {
        if (child.type === "keyword_argument") {
            continue
        }

        pushUnique(baseTypes, readNodeText(child))
    }

    return baseTypes
}

/**
 * Collects enum member names from enum body.
 *
 * @param enumBody Enum body node.
 * @returns Member names.
 */
function collectEnumMembers(enumBody: ISyntaxNode | undefined): readonly string[] {
    if (enumBody === undefined) {
        return []
    }

    const members: string[] = []
    for (const child of enumBody.namedChildren) {
        if (child.type === "property_identifier") {
            pushUnique(members, child.text.trim())
            continue
        }

        const nameNode = findFirstNamedChild(child, ["property_identifier", "string", "identifier"])
        const memberName = readStringNodeValue(nameNode) ?? readNodeText(nameNode)
        pushUnique(members, memberName)
    }

    return members
}

/**
 * Splits clause text by top-level commas after stripping clause keyword.
 *
 * @param clauseText Raw clause text.
 * @param keyword Leading clause keyword.
 * @returns Trimmed values in declaration order.
 */
function splitClauseValues(clauseText: string | undefined, keyword: string): readonly string[] {
    if (clauseText === undefined) {
        return []
    }

    const normalizedClause = clauseText.trim()
    if (normalizedClause.length === 0) {
        return []
    }

    const body = normalizedClause.replace(new RegExp(`^${keyword}\\s+`), "")
    return splitTopLevelCommaSeparated(body)
}

/**
 * Splits generic-aware comma-separated value list.
 *
 * @param value Clause body without keyword.
 * @returns Trimmed items.
 */
function splitTopLevelCommaSeparated(value: string): readonly string[] {
    const items: string[] = []
    let current = ""
    let genericDepth = 0

    for (const character of value) {
        if (character === "<") {
            genericDepth += 1
            current += character
            continue
        }

        if (character === ">" && genericDepth > 0) {
            genericDepth -= 1
            current += character
            continue
        }

        if (character === "," && genericDepth === 0) {
            pushUnique(items, current.trim())
            current = ""
            continue
        }

        current += character
    }

    pushUnique(items, current.trim())
    return items
}

/**
 * Pushes non-empty unique value into collection.
 *
 * @param collection Mutable string list.
 * @param value Candidate value.
 */
function pushUnique(collection: string[], value: string | undefined): void {
    if (value === undefined || value.length === 0) {
        return
    }

    if (!collection.includes(value)) {
        collection.push(value)
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
