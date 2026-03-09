import { z } from "zod"

import { parseBulkRepositoryList } from "./bulk-repository-parser"
import type { IOnboardingFormValues } from "./onboarding-wizard-types"
import {
    GIT_PROVIDER_OPTIONS,
    ONBOARDING_MODE_OPTIONS,
    ONBOARDING_TEMPLATE_IDS,
    SCAN_MODE_OPTIONS,
    SCAN_SCHEDULE_OPTIONS,
} from "./onboarding-wizard-types"

/**
 * Zod-схема для необязательного email-поля.
 */
const EMAIL_OPTIONAL_SCHEMA = z
    .string()
    .trim()
    .max(256, "Email слишком длинный")
    .refine(
        (value): boolean => value.length === 0 || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
        "Введите корректный email",
    )

/**
 * Zod-схема формы мастера onboarding с кросс-полевой валидацией.
 */
export const ONBOARDING_FORM_SCHEMA = z
    .object({
        provider: z.enum(GIT_PROVIDER_OPTIONS),
        onboardingTemplateId: z.enum(ONBOARDING_TEMPLATE_IDS),
        onboardingMode: z.enum(ONBOARDING_MODE_OPTIONS),
        repositoryUrl: z.string().trim(),
        repositoryUrlList: z.string().trim(),
        scanMode: z.enum(SCAN_MODE_OPTIONS),
        scanSchedule: z.enum(SCAN_SCHEDULE_OPTIONS),
        scanThreads: z.coerce
            .number()
            .int("Количество воркеров должно быть целым")
            .min(1, "Количество воркеров не должно быть меньше 1")
            .max(32, "Количество воркеров не должно превышать 32"),
        includeSubmodules: z.boolean(),
        includeHistory: z.boolean(),
        tags: z.string().trim().max(256, "Теги слишком длинные"),
        notifyEmail: EMAIL_OPTIONAL_SCHEMA,
    })
    .superRefine((values, context): void => {
        if (values.onboardingMode === "single") {
            const urlSchema = z
                .string()
                .trim()
                .min(1, "Введите URL репозитория")
                .url("Введите корректный URL репозитория")

            const validation = urlSchema.safeParse(values.repositoryUrl)
            if (validation.success === false) {
                const firstIssue = validation.error.issues.at(0)
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        firstIssue?.code === "too_small"
                            ? "Введите URL репозитория"
                            : "Введите корректный URL репозитория",
                    path: ["repositoryUrl"],
                })
            }

            return
        }

        const parsed = parseBulkRepositoryList(values.repositoryUrlList)
        if (parsed.repositories.length === 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Добавьте минимум один корректный URL репозитория",
                path: ["repositoryUrlList"],
            })
        }

        if (parsed.invalidLines.length === 0) {
            return
        }

        const preview = parsed.invalidLines
            .map((item): string => `${String(item.line)}: ${item.value}`)
            .slice(0, 3)
            .join("; ")
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Некорректные ссылки: ${preview}`,
            path: ["repositoryUrlList"],
        })
    })

/**
 * Значения формы onboarding по умолчанию.
 */
export const DEFAULT_ONBOARDING_VALUES: IOnboardingFormValues = {
    provider: "github",
    onboardingTemplateId: "custom",
    onboardingMode: "single",
    repositoryUrl: "",
    repositoryUrlList: "",
    scanMode: "incremental",
    scanSchedule: "manual",
    scanThreads: 4,
    includeSubmodules: true,
    includeHistory: false,
    tags: "",
    notifyEmail: "",
}
