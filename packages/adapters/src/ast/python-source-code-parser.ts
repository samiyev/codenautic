import Parser from "tree-sitter"
import Python from "tree-sitter-python"

import {AST_LANGUAGE, type SupportedLanguage} from "@codenautic/core"

import {BaseParser} from "./base-parser"

/**
 * Supported python parser language variants.
 */
export type PythonParserLanguage = typeof AST_LANGUAGE.PYTHON

/**
 * Construction options for python source parser.
 */
export interface IPythonSourceCodeParserOptions {
    /**
     * Canonical language variant exposed by parser.
     */
    readonly language: PythonParserLanguage
}

/**
 * Dedicated tree-sitter parser for python source files.
 */
export class PythonSourceCodeParser extends BaseParser {
    /**
     * Creates parser for python source files.
     *
     * @param options Canonical python language variant.
     */
    public constructor(options: IPythonSourceCodeParserOptions) {
        const parser = new Parser()
        parser.setLanguage(resolvePythonGrammar(options.language))

        super({
            language: options.language,
            parser,
        })
    }
}

/**
 * Resolves tree-sitter grammar module for python language variant.
 *
 * @param _language Canonical python language.
 * @returns Tree-sitter grammar module.
 */
function resolvePythonGrammar(_language: PythonParserLanguage): Parser.Language {
    return Python as unknown as Parser.Language
}

/**
 * Narrows supported language to python variant.
 *
 * @param language Canonical supported language.
 * @returns Python language variant.
 * @throws Error When language is not python.
 */
export function assertPythonParserLanguage(language: SupportedLanguage): PythonParserLanguage {
    if (language === AST_LANGUAGE.PYTHON) {
        return language
    }

    throw new Error(`Unsupported Python parser language: ${language}`)
}
