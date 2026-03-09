import Parser from "tree-sitter"

import type {SupportedLanguage} from "@codenautic/core"

import {BaseParser} from "./base-parser"

/**
 * Construction options for a concrete tree-sitter backed source parser.
 */
export interface ITreeSitterSourceCodeParserOptions {
    /**
     * Canonical language exposed by adapter.
     */
    readonly language: SupportedLanguage

    /**
     * Tree-sitter grammar module for the target language.
     */
    readonly grammar: Parser.Language
}

/**
 * Concrete source-code parser backed by one configured tree-sitter instance.
 */
export class TreeSitterSourceCodeParser extends BaseParser {
    /**
     * Creates parser for one canonical language.
     *
     * @param options Canonical language and grammar module.
     */
    public constructor(options: ITreeSitterSourceCodeParserOptions) {
        const parser = new Parser()
        parser.setLanguage(options.grammar)
        super({
            language: options.language,
            parser,
        })
    }
}
