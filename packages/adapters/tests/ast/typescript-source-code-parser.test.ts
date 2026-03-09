import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_LANGUAGE,
    type ISourceCodeParseRequest,
} from "@codenautic/core"

import {
    assertTypeScriptParserLanguage,
    TypeScriptSourceCodeParser,
} from "../../src/ast"

describe("TypeScriptSourceCodeParser", () => {
    test("parses .ts source files with type aliases, interfaces, enums, classes, and functions", async () => {
        const parser = new TypeScriptSourceCodeParser({
            language: AST_LANGUAGE.TYPESCRIPT,
        })
        const request: ISourceCodeParseRequest = {
            filePath: "src/domain/review.ts",
            content: [
                'export type ReviewId = string',
                'export interface ReviewContext extends BaseContext, Cacheable {}',
                'export enum ReviewMode { FAST, FULL = 2 }',
                'export class ReviewService extends BaseService implements Disposable {',
                '    public run(input: ReviewId): ReviewContext {',
                '        return buildContext(input)',
                '    }',
                '}',
                'export async function bootstrap(): Promise<void> {',
                '    await startReview()',
                '}',
            ].join("\n"),
        }

        const result = await parser.parse(request)

        expect(result.language).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(result.hasSyntaxErrors).toBe(false)
        expect(result.typeAliases[0]?.name).toBe("ReviewId")
        expect(result.interfaces[0]?.extendsTypes).toEqual(["BaseContext", "Cacheable"])
        expect(result.enums[0]?.members).toEqual(["FAST", "FULL"])
        expect(result.classes[0]?.name).toBe("ReviewService")
        expect(result.classes[0]?.implementsTypes).toEqual(["Disposable"])
        expect(result.functions).toEqual([
            {
                name: "run",
                kind: AST_FUNCTION_KIND.METHOD,
                exported: false,
                async: false,
                parentClassName: "ReviewService",
                location: {
                    lineStart: 5,
                    lineEnd: 7,
                    columnStart: 5,
                    columnEnd: 6,
                },
            },
            {
                name: "bootstrap",
                kind: AST_FUNCTION_KIND.FUNCTION,
                exported: true,
                async: true,
                location: {
                    lineStart: 9,
                    lineEnd: 11,
                    columnStart: 8,
                    columnEnd: 2,
                },
            },
        ])
        expect(result.calls.map((entry) => entry.callee)).toEqual(["buildContext", "startReview"])
    })

    test("parses .tsx source files and preserves tsx language marker", async () => {
        const parser = new TypeScriptSourceCodeParser({
            language: AST_LANGUAGE.TSX,
        })
        const request: ISourceCodeParseRequest = {
            filePath: "src/ui/review-card.tsx",
            content: [
                'type Props = { readonly title: string }',
                'export function ReviewCard({title}: Props): JSX.Element {',
                '    return <section><h1>{title}</h1></section>',
                '}',
            ].join("\n"),
        }

        const result = await parser.parse(request)

        expect(result.language).toBe(AST_LANGUAGE.TSX)
        expect(result.hasSyntaxErrors).toBe(false)
        expect(result.typeAliases[0]?.name).toBe("Props")
        expect(result.functions[0]).toEqual({
            name: "ReviewCard",
            kind: AST_FUNCTION_KIND.FUNCTION,
            exported: true,
            async: false,
            location: {
                lineStart: 2,
                lineEnd: 4,
                columnStart: 8,
                columnEnd: 2,
            },
        })
    })

    test("narrows only typescript-family languages", () => {
        expect(assertTypeScriptParserLanguage(AST_LANGUAGE.TYPESCRIPT)).toBe(
            AST_LANGUAGE.TYPESCRIPT,
        )
        expect(assertTypeScriptParserLanguage(AST_LANGUAGE.TSX)).toBe(AST_LANGUAGE.TSX)
        expect(() => assertTypeScriptParserLanguage(AST_LANGUAGE.JAVASCRIPT)).toThrow(
            "Unsupported TypeScript parser language: javascript",
        )
    })
})
