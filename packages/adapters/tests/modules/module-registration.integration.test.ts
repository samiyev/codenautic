import {describe, expect, test} from "bun:test"

import {Container} from "@codenautic/core"

import {
    GIT_TOKENS,
    GitLabMergeRequestAcl,
    registerGitModule,
} from "../../src/git"
import {
    AnthropicCompletionAcl,
    LLM_TOKENS,
    LlmFallbackPolicy,
    OpenAiCompletionAcl,
    registerLlmModule,
} from "../../src/llm"
import {
    CONTEXT_TOKENS,
    JiraIssueAcl,
    registerContextModule,
} from "../../src/context"
import {
    INBOX_DEDUP_STATUS,
    MESSAGING_TOKENS,
    OUTBOX_WRITE_STATUS,
    InboxDeduplicatorAdapter,
    OutboxWriterAdapter,
    registerMessagingModule,
} from "../../src/messaging"

describe("Git module registration", () => {
    test("registers default singleton dependencies", () => {
        const container = new Container()

        registerGitModule(container)

        expect(container.has(GIT_TOKENS.GitLabMergeRequestAcl)).toBe(true)
        const first = container.resolve(GIT_TOKENS.GitLabMergeRequestAcl)
        const second = container.resolve(GIT_TOKENS.GitLabMergeRequestAcl)

        expect(first instanceof GitLabMergeRequestAcl).toBe(true)
        expect(first === second).toBe(true)
    })

    test("uses override instances when provided", () => {
        const container = new Container()
        const customAcl = new GitLabMergeRequestAcl()

        registerGitModule(container, {
            gitLabMergeRequestAcl: customAcl,
        })

        const resolved = container.resolve(GIT_TOKENS.GitLabMergeRequestAcl)
        expect(resolved).toBe(customAcl)
    })
})

describe("LLM module registration", () => {
    test("registers default singleton dependencies", () => {
        const container = new Container()

        registerLlmModule(container)

        expect(container.has(LLM_TOKENS.OpenAiCompletionAcl)).toBe(true)
        expect(container.has(LLM_TOKENS.AnthropicCompletionAcl)).toBe(true)
        expect(container.has(LLM_TOKENS.FallbackPolicy)).toBe(true)

        const openAiFirst = container.resolve(LLM_TOKENS.OpenAiCompletionAcl)
        const openAiSecond = container.resolve(LLM_TOKENS.OpenAiCompletionAcl)
        const anthropicFirst = container.resolve(LLM_TOKENS.AnthropicCompletionAcl)
        const anthropicSecond = container.resolve(LLM_TOKENS.AnthropicCompletionAcl)
        const fallbackFirst = container.resolve(LLM_TOKENS.FallbackPolicy)
        const fallbackSecond = container.resolve(LLM_TOKENS.FallbackPolicy)

        expect(openAiFirst instanceof OpenAiCompletionAcl).toBe(true)
        expect(anthropicFirst instanceof AnthropicCompletionAcl).toBe(true)
        expect(fallbackFirst instanceof LlmFallbackPolicy).toBe(true)
        expect(openAiFirst === openAiSecond).toBe(true)
        expect(anthropicFirst === anthropicSecond).toBe(true)
        expect(fallbackFirst === fallbackSecond).toBe(true)
    })

    test("uses override instances when provided", () => {
        const container = new Container()
        const customOpenAiAcl = new OpenAiCompletionAcl()
        const customAnthropicAcl = new AnthropicCompletionAcl()
        const customFallbackPolicy = new LlmFallbackPolicy()

        registerLlmModule(container, {
            openAiCompletionAcl: customOpenAiAcl,
            anthropicCompletionAcl: customAnthropicAcl,
            fallbackPolicy: customFallbackPolicy,
        })

        expect(container.resolve(LLM_TOKENS.OpenAiCompletionAcl)).toBe(customOpenAiAcl)
        expect(container.resolve(LLM_TOKENS.AnthropicCompletionAcl)).toBe(customAnthropicAcl)
        expect(container.resolve(LLM_TOKENS.FallbackPolicy)).toBe(customFallbackPolicy)
    })
})

describe("Context module registration", () => {
    test("registers default singleton dependencies", () => {
        const container = new Container()

        registerContextModule(container)

        expect(container.has(CONTEXT_TOKENS.JiraIssueAcl)).toBe(true)
        const first = container.resolve(CONTEXT_TOKENS.JiraIssueAcl)
        const second = container.resolve(CONTEXT_TOKENS.JiraIssueAcl)

        expect(first instanceof JiraIssueAcl).toBe(true)
        expect(first === second).toBe(true)
    })

    test("uses override instance when provided", () => {
        const container = new Container()
        const customAcl = new JiraIssueAcl()

        registerContextModule(container, {
            jiraIssueAcl: customAcl,
        })

        expect(container.resolve(CONTEXT_TOKENS.JiraIssueAcl)).toBe(customAcl)
    })
})

describe("Messaging module registration", () => {
    test("registers default singleton dependencies", () => {
        const container = new Container()

        registerMessagingModule(container)

        expect(container.has(MESSAGING_TOKENS.OutboxWriter)).toBe(true)
        expect(container.has(MESSAGING_TOKENS.InboxDeduplicator)).toBe(true)

        const outboxFirst = container.resolve(MESSAGING_TOKENS.OutboxWriter)
        const outboxSecond = container.resolve(MESSAGING_TOKENS.OutboxWriter)
        const inboxFirst = container.resolve(MESSAGING_TOKENS.InboxDeduplicator)
        const inboxSecond = container.resolve(MESSAGING_TOKENS.InboxDeduplicator)

        expect(outboxFirst instanceof OutboxWriterAdapter).toBe(true)
        expect(inboxFirst instanceof InboxDeduplicatorAdapter).toBe(true)
        expect(outboxFirst === outboxSecond).toBe(true)
        expect(inboxFirst === inboxSecond).toBe(true)

        const outboxWrite = outboxFirst.write({
            messageKey: "msg-default-module",
            topic: "review.started",
            payload: {
                reviewId: "rev-module",
            },
        })
        const inboxRegister = inboxFirst.register("msg-default-module")

        expect(outboxWrite.isOk).toBe(true)
        expect(inboxRegister.isOk).toBe(true)
        if (outboxWrite.isFail || inboxRegister.isFail) {
            throw new Error("Expected successful messaging operations")
        }

        expect(outboxWrite.value.status).toBe(OUTBOX_WRITE_STATUS.STORED)
        expect(inboxRegister.value.status).toBe(INBOX_DEDUP_STATUS.ACCEPTED)
    })

    test("uses override instances when provided", () => {
        const container = new Container()
        const customOutbox = new OutboxWriterAdapter(() => new Date("2026-03-03T00:00:00.000Z"))
        const customInbox = new InboxDeduplicatorAdapter()

        registerMessagingModule(container, {
            outboxWriter: customOutbox,
            inboxDeduplicator: customInbox,
        })

        expect(container.resolve(MESSAGING_TOKENS.OutboxWriter)).toBe(customOutbox)
        expect(container.resolve(MESSAGING_TOKENS.InboxDeduplicator)).toBe(customInbox)
    })
})
