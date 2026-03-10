import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { OnboardingWizardPage } from "@/pages/onboarding-wizard"
import { renderWithProviders } from "../utils/render"

async function moveToRepositoryStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole("button", { name: "Connect provider" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
}

describe("OnboardingWizardPage", (): void => {
    it("не пускает на следующий шаг без корректного URL репозитория", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        const repositoryInput = screen.getByRole("textbox", { name: "Repository URL" })
        const nextButton = screen.getByRole("button", { name: "Next" })

        await user.type(repositoryInput, "bad-url")
        await user.click(nextButton)

        expect(screen.queryByText("Введите корректный URL репозитория")).not.toBeNull()
        expect(screen.queryByRole("button", { name: "Launch scan" })).toBeNull()
    })

    it("валидирует второй шаг и проводит пользователя к обзору перед запуском", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        const repositoryInput = screen.getByRole("textbox", { name: "Repository URL" })
        await user.type(repositoryInput, "https://github.com/example/repository")
        await user.click(screen.getByRole("button", { name: "Next" }))
        expect(screen.queryByText("Review the selected settings:")).not.toBeNull()

        const workersInput = screen.getByRole("spinbutton", { name: "Worker count" })
        await user.clear(workersInput)
        await user.type(workersInput, "0")
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(screen.queryByText(/Worker count/u)).not.toBeNull()

        await user.clear(workersInput)
        await user.type(workersInput, "8")
        await user.click(screen.getByRole("button", { name: "Launch scan" }))
    })

    it("запускает сканирование с выбранными параметрами", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.type(
            screen.getByRole("textbox", { name: "Repository URL" }),
            "https://github.com/example/repository",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(onScanStart).toHaveBeenCalledTimes(1)
        expect(onScanStart.mock.calls.at(0)?.at(0)).toMatchObject({
            repositoryUrl: "https://github.com/example/repository",
            scanMode: "incremental",
            scanSchedule: "manual",
            scanThreads: 4,
            includeSubmodules: true,
            includeHistory: false,
            notifyEmail: "",
        })
    })

    it("валидирует список репозиториев в bulk-режиме и показывает ошибки по строкам", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/first\ninvalid-url",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))

        expect(screen.queryByText(/Некорректные ссылки:.*invalid-url/)).not.toBeNull()
        expect(screen.queryByText(/Selected/u)).not.toBeNull()
    })

    it("запускает bulk onboarding по общему шаблону и показывает ошибочный репозиторий", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/first\nhttps://github.com/org/second",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(onScanStart).toHaveBeenCalledTimes(1)
        expect(onScanStart.mock.calls.at(0)?.at(0)).toMatchObject({
            onboardingMode: "bulk",
            scanMode: "incremental",
            scanSchedule: "manual",
            scanThreads: 4,
            includeSubmodules: true,
            includeHistory: false,
            notifyEmail: "",
            targetRepositories: ["https://github.com/org/first", "https://github.com/org/second"],
        })
        expect(screen.queryByText("Bulk scan progress")).not.toBeNull()
        expect(
            screen.queryByText("Сканирование прервано: ошибка доступа к репозиторию"),
        ).not.toBeNull()
    })

    it("показывает предпросмотр шаблона и применяет его в single режиме", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.type(
            screen.getByRole("textbox", { name: "Repository URL" }),
            "https://github.com/example/repository",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))

        await user.click(await screen.findByRole("radio", { name: "Security Baseline — v1.2.0" }))
        expect(screen.queryByText("What will be applied")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Apply template" }))
        expect(screen.queryAllByText(/Mode:/u).length).toBeGreaterThan(0)
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(onScanStart).toHaveBeenCalledTimes(1)
        expect(onScanStart.mock.calls.at(0)?.at(0)).toMatchObject({
            onboardingTemplateId: "security-baseline",
            appliedTemplate: {
                id: "security-baseline",
                name: "Security Baseline",
                rulesPreset: "security-first",
                version: "v1.2.0",
            },
            scanMode: "full",
            scanSchedule: "daily",
            scanThreads: 8,
            includeSubmodules: true,
            includeHistory: true,
            notifyEmail: "security-ops@example.com",
            tags: "security, policy, sensitive",
        })
    })

    it("поддерживает rollback после применения шаблона", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.type(
            screen.getByRole("textbox", { name: "Repository URL" }),
            "https://github.com/example/repository",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))

        const workersInput = screen.getByRole("spinbutton", { name: "Worker count" })
        await user.clear(workersInput)
        await user.type(workersInput, "2")

        await user.click(await screen.findByRole("radio", { name: "Quality Scan — v1.0.1" }))
        await user.click(screen.getByRole("button", { name: "Apply template" }))
        expect(
            screen.getByRole<HTMLInputElement>("spinbutton", {
                name: "Worker count",
            }).value,
        ).toBe("6")

        await user.click(screen.getByText("Applied templates (audit log)"))
        await user.click(screen.getByRole("button", { name: "Rollback last application" }))
        expect(screen.queryByText("Applied templates (audit log)")).not.toBeNull()
    })

    it("навигация назад возвращает на предыдущий шаг", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        expect(screen.queryByText("Repository URL")).not.toBeNull()

        const backButton = screen.getByRole("button", { name: "Back" })
        await user.click(backButton)

        expect(screen.queryByText("Git provider")).not.toBeNull()
        expect(screen.queryByText("Repository URL")).toBeNull()
    })

    it("кнопка 'Назад' заблокирована на первом шаге", async (): Promise<void> => {
        renderWithProviders(<OnboardingWizardPage />)

        const backButton = screen.getByRole("button", { name: "Back" })
        expect(backButton).toHaveAttribute("disabled")
    })

    it("показывает индикатор шагов и позволяет вернуться на пройденный шаг", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.type(
            screen.getByRole("textbox", { name: "Repository URL" }),
            "https://github.com/example/repository",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))

        expect(screen.queryByText("Review the selected settings:")).not.toBeNull()

        const stepOneButton = screen.getByRole("button", { name: /Step 1/u })
        await user.click(stepOneButton)

        expect(screen.queryByText("Git provider")).not.toBeNull()
        expect(screen.queryByText("Review the selected settings:")).toBeNull()
    })

    it("финальный шаг отображает кнопку 'Запустить сканирование' вместо 'Далее'", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.type(
            screen.getByRole("textbox", { name: "Repository URL" }),
            "https://github.com/example/repository",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))

        expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Launch scan" })).not.toBeNull()
    })

    it("не пускает на следующий шаг без подключения провайдера", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)

        await user.click(screen.getByRole("button", { name: "Next" }))

        expect(screen.queryByText("Connect the Git provider first.")).not.toBeNull()
        expect(screen.queryByText("Repository URL")).toBeNull()
    })

    it("показывает пустое состояние в bulk-режиме при отсутствии URL", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))

        expect(screen.queryByText("Add repository URLs in the field above.")).not.toBeNull()
    })

    it("поддерживает выбор/снятие всех репозиториев в bulk-режиме", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/repo-a\nhttps://github.com/org/repo-b",
        )

        expect(screen.queryByText(/Selected/u)).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Deselect all" }))
        expect(screen.queryByText(/Selected/u)).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Select all" }))
        expect(screen.queryByText(/Selected/u)).not.toBeNull()
    })

    it("поддерживает паузу и возобновление bulk-задач", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/first\nhttps://github.com/org/second\nhttps://github.com/org/third",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(screen.queryByText("Bulk scan progress")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Pause" }))
        expect(screen.queryAllByText("Paused").length).toBeGreaterThan(0)

        await user.click(screen.getByRole("button", { name: "Resume" }))
        expect(screen.queryAllByText("Running").length).toBeGreaterThan(0)
    })

    it("поддерживает отмену всех bulk-задач", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/first\nhttps://github.com/org/second\nhttps://github.com/org/third",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        await user.click(screen.getByRole("button", { name: "Cancel all" }))
        expect(screen.queryAllByText("Cancelled").length).toBeGreaterThan(0)
    })

    it("позволяет retry ошибочной bulk-задачи", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/first\nhttps://github.com/org/second",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull()
        await user.click(screen.getByRole("button", { name: "Retry" }))

        expect(screen.queryByText("Scan aborted: repository access error")).toBeNull()
    })

    it("позволяет отменить отдельную running bulk-задачу", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()

        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/first\nhttps://github.com/org/second\nhttps://github.com/org/third",
        )
        await user.click(screen.getByRole("button", { name: "Next" }))
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        const cancelButtons = screen.queryAllByRole("button", { name: "Cancel" })
        expect(cancelButtons.length).toBeGreaterThan(0)

        await user.click(cancelButtons[0] as HTMLElement)
        expect(screen.queryAllByText("Cancelled").length).toBeGreaterThan(0)
    })

    it("не пускает в bulk-режиме без выбора ни одного репозитория", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<OnboardingWizardPage />)
        await moveToRepositoryStep(user)

        await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
        await user.type(
            screen.getByRole("textbox", {
                name: "Repository list (one link per line)",
            }),
            "https://github.com/org/repo-a",
        )
        await user.click(screen.getByRole("button", { name: "Deselect all" }))
        await user.click(screen.getByRole("button", { name: "Next" }))

        expect(screen.queryByText("Select at least one repository to launch.")).not.toBeNull()
    })
})
