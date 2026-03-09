import Parser from "tree-sitter"
import TypeScript from "tree-sitter-typescript"

import {AST_LANGUAGE, type SupportedLanguage} from "@codenautic/core"

import {BaseParser} from "./base-parser"

/**
 * Supported TypeScript parser language variants.
 */
export type TypeScriptParserLanguage =
    | typeof AST_LANGUAGE.TYPESCRIPT
    | typeof AST_LANGUAGE.TSX

/**
 * Construction options for TypeScript-family source parser.
 */
export interface ITypeScriptSourceCodeParserOptions {
    /**
     * Canonical language variant exposed by parser.
     */
    readonly language: TypeScriptParserLanguage
}

/**
 * Dedicated tree-sitter parser for TypeScript and TSX source files.
 */
export class TypeScriptSourceCodeParser extends BaseParser {
    /**
     * Creates parser for TypeScript-family source files.
     *
     * @param options Canonical TypeScript language variant.
     */
    public constructor(options: ITypeScriptSourceCodeParserOptions) {
        const parser = new Parser()
        parser.setLanguage(resolveTypeScriptGrammar(options.language))

        super({
            language: options.language,
            parser,
        })
    }
}

/**
 * Resolves tree-sitter grammar module for TypeScript language variant.
 *
 * @param language Canonical TypeScript family language.
 * @returns Tree-sitter grammar module.
 */
function resolveTypeScriptGrammar(
    language: TypeScriptParserLanguage,
): Parser.Language {
    if (language === AST_LANGUAGE.TSX) {
        return TypeScript.tsx as unknown as Parser.Language
    }

    return TypeScript.typescript as unknown as Parser.Language
}

/**
 * Narrows supported language to TypeScript-family variant.
 *
 * @param language Canonical supported language.
 * @returns TypeScript family language variant.
 * @throws Error When language is not a TypeScript family member.
 */
export function assertTypeScriptParserLanguage(
    language: SupportedLanguage,
): TypeScriptParserLanguage {
    if (language === AST_LANGUAGE.TYPESCRIPT || language === AST_LANGUAGE.TSX) {
        return language
    }

    throw new Error(`Unsupported TypeScript parser language: ${language}`)
}
