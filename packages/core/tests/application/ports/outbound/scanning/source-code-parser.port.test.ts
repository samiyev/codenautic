import {describe, expect, test} from "bun:test"

import {
    AST_LANGUAGE,
    type IParsedSourceFileDTO,
    type ISourceCodeParseRequest,
    type ISourceCodeParser,
} from "../../../../../src"

class InMemorySourceCodeParser implements ISourceCodeParser {
    public readonly language = AST_LANGUAGE.TYPESCRIPT

    public parse(request: ISourceCodeParseRequest): Promise<IParsedSourceFileDTO> {
        return Promise.resolve({
            filePath: request.filePath,
            language: this.language,
            hasSyntaxErrors: false,
            imports: [],
            typeAliases: [],
            interfaces: [],
            enums: [],
            classes: [],
            functions: [],
            calls: [],
        })
    }
}

describe("ISourceCodeParser contract", () => {
    test("parses one file into deterministic AST snapshot", async () => {
        const parser = new InMemorySourceCodeParser()
        const result = await parser.parse({
            filePath: "src/index.ts",
            content: "export const value = 1",
        })

        expect(parser.language).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(result.filePath).toBe("src/index.ts")
        expect(result.language).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(result.functions).toHaveLength(0)
    })
})
