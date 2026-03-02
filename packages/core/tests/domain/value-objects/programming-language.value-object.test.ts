import {describe, expect, test} from "bun:test"

import {
    PROGRAMMING_LANGUAGE,
    ProgrammingLanguage,
} from "../../../src/domain/value-objects/programming-language.value-object"

describe("ProgrammingLanguage", () => {
    test("maps known file extensions", () => {
        expect(ProgrammingLanguage.fromExtension(".ts").toString()).toBe(PROGRAMMING_LANGUAGE.JSTS)
        expect(ProgrammingLanguage.fromExtension("py").toString()).toBe(PROGRAMMING_LANGUAGE.PYTHON)
        expect(ProgrammingLanguage.fromExtension(".go").toString()).toBe(PROGRAMMING_LANGUAGE.GO)
        expect(ProgrammingLanguage.fromExtension(".java").toString()).toBe(PROGRAMMING_LANGUAGE.JAVA)
        expect(ProgrammingLanguage.fromExtension(".cs").toString()).toBe(PROGRAMMING_LANGUAGE.CSHARP)
        expect(ProgrammingLanguage.fromExtension(".rb").toString()).toBe(PROGRAMMING_LANGUAGE.RUBY)
        expect(ProgrammingLanguage.fromExtension(".rs").toString()).toBe(PROGRAMMING_LANGUAGE.RUST)
        expect(ProgrammingLanguage.fromExtension(".php").toString()).toBe(PROGRAMMING_LANGUAGE.PHP)
        expect(ProgrammingLanguage.fromExtension(".kt").toString()).toBe(PROGRAMMING_LANGUAGE.KOTLIN)
        expect(ProgrammingLanguage.fromExtension(".dart").toString()).toBe(PROGRAMMING_LANGUAGE.DART)
        expect(ProgrammingLanguage.fromExtension(".scala").toString()).toBe(PROGRAMMING_LANGUAGE.SCALA)
    })

    test("maps dockerfile marker and unknown extension", () => {
        expect(ProgrammingLanguage.fromExtension("Dockerfile").toString()).toBe(
            PROGRAMMING_LANGUAGE.DOCKERFILE,
        )
        expect(ProgrammingLanguage.fromExtension(".unknown").toString()).toBe(PROGRAMMING_LANGUAGE.UNKNOWN)
    })

    test("maps shebang lines", () => {
        expect(ProgrammingLanguage.fromShebang("#!/usr/bin/env python3").toString()).toBe(
            PROGRAMMING_LANGUAGE.PYTHON,
        )
        expect(ProgrammingLanguage.fromShebang("#!/usr/bin/env node").toString()).toBe(
            PROGRAMMING_LANGUAGE.JSTS,
        )
        expect(ProgrammingLanguage.fromShebang("#!/usr/bin/ruby").toString()).toBe(
            PROGRAMMING_LANGUAGE.RUBY,
        )
        expect(ProgrammingLanguage.fromShebang("#!/usr/bin/env php").toString()).toBe(
            PROGRAMMING_LANGUAGE.PHP,
        )
        expect(ProgrammingLanguage.fromShebang("#!/usr/bin/env bash").toString()).toBe(
            PROGRAMMING_LANGUAGE.UNKNOWN,
        )
    })

    test("returns unknown for lines without shebang", () => {
        expect(ProgrammingLanguage.fromShebang("console.log('hi')").toString()).toBe(
            PROGRAMMING_LANGUAGE.UNKNOWN,
        )
    })
})
