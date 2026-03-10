import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsContractValidationPage } from "@/pages/settings-contract-validation"
import { renderWithProviders } from "../utils/render"

describe("SettingsContractValidationPage", (): void => {
    it("валидирует контракт, показывает migration hints и применяет preview", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        expect(
            screen.getByRole("heading", { level: 1, name: "Contract validation" }),
        ).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Validate contract" }))
        await waitFor(() => {
            expect(screen.getByText("Contract is valid")).not.toBeNull()
        })
        expect(screen.getByText("Migration hints")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Apply validated contract" }))
        await waitFor(() => {
            expect(screen.getByText(/Applied theme-library contract v1/)).not.toBeNull()
        })
    })

    it("возвращает actionable errors для некорректного JSON", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.clear(screen.getByRole("textbox", { name: "Contract json" }))
        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: { value: "{bad json" },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor(() => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/Invalid JSON format/)).not.toBeNull()
    })

    it("валидирует architecture blueprint yaml и показывает visual preview", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        expect(screen.getByLabelText("Blueprint syntax highlight preview")).not.toBeNull()
        expect(screen.getByLabelText("Blueprint visual nodes list")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Validate blueprint" }))
        await waitFor(() => {
            expect(screen.getByText("Blueprint is valid")).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Apply blueprint" }))
        await waitFor(() => {
            expect(screen.getByText(/Applied architecture blueprint/)).not.toBeNull()
        })
    })

    it("показывает ошибки для blueprint без обязательных секций", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.clear(screen.getByRole("textbox", { name: "Architecture blueprint yaml" }))
        fireEvent.change(screen.getByRole("textbox", { name: "Architecture blueprint yaml" }), {
            target: {
                value: "version: 1\nlayers:\n  - name: domain",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate blueprint" }))

        await waitFor(() => {
            expect(screen.getByText("Blueprint validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Blueprint must include `rules` section.")).not.toBeNull()
    })

    it("фильтрует, сортирует и экспортирует drift analysis report", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        expect(
            screen.getByText("Layer violation: infrastructure imports domain directly"),
        ).not.toBeNull()
        expect(
            screen.getByText("Dependency cycle between application and infrastructure"),
        ).not.toBeNull()

        await user.selectOptions(screen.getByLabelText("Drift severity filter"), "critical")
        await waitFor(() => {
            expect(
                screen.getByText("Dependency cycle between application and infrastructure"),
            ).not.toBeNull()
        })
        expect(
            screen.queryByText("Layer violation: infrastructure imports domain directly"),
        ).toBeNull()

        await user.selectOptions(screen.getByLabelText("Drift report sort mode"), "files-desc")
        await user.clear(screen.getByRole("textbox", { name: "Drift report search query" }))
        await user.type(screen.getByRole("textbox", { name: "Drift report search query" }), "cycle")

        await user.click(screen.getByRole("button", { name: "Export drift report" }))
        await waitFor(() => {
            expect(screen.getByText(/Exported drift report with 1 violations/)).not.toBeNull()
        })
        expect(screen.getByLabelText("Drift report export payload").textContent).toContain(
            '"totalViolations": 1',
        )
    })

    it("показывает детали нарушения после клика по файлу в drift overlay treemap", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        expect(screen.getByText("Drift overlay CodeCity")).not.toBeNull()

        await user.click(
            screen.getByRole("button", { name: "src/infrastructure/http/review.controller.ts" }),
        )
        await waitFor(() => {
            expect(screen.getByLabelText("Selected drift file violations")).not.toBeNull()
        })
        expect(
            screen.getAllByText("src/infrastructure/http/review.controller.ts").length,
        ).toBeGreaterThan(0)
        expect(screen.getByLabelText("Selected drift file violations")).not.toBeNull()
        expect(
            screen.getByText("Layer violation: infrastructure imports domain directly"),
        ).not.toBeNull()
    })

    it("показывает side-by-side blueprint vs reality с color-coded differences", (): void => {
        renderWithProviders(<SettingsContractValidationPage />)

        expect(screen.getByText("Blueprint vs reality view")).not.toBeNull()
        expect(screen.getByLabelText("Blueprint intended architecture list")).not.toBeNull()
        expect(screen.getByLabelText("Reality architecture list")).not.toBeNull()
        expect(screen.getByText(/Matches: 3 · Missing: 0 · Unexpected: 1/)).not.toBeNull()
        expect(screen.getByLabelText("Architecture differences list")).not.toBeNull()
        expect(
            screen.getAllByText("Dependency direction mismatch for aggregate access path.").length,
        ).toBeGreaterThan(0)
    })

    it("показывает drift trend chart с аннотациями архитектурных изменений", (): void => {
        renderWithProviders(<SettingsContractValidationPage />)

        expect(screen.getByText("Drift trend chart")).not.toBeNull()
        expect(screen.getByLabelText("Drift score trend chart")).not.toBeNull()
        expect(screen.getByLabelText("Architecture change annotations list")).not.toBeNull()
        expect(
            screen.getByText(/ADR-021: Introduced anti-corruption layer for provider boundaries\./),
        ).not.toBeNull()
    })

    it("настраивает drift alerts по severity threshold, violation count и channels", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.selectOptions(
            screen.getByLabelText("Drift alert severity threshold"),
            "critical",
        )
        await user.clear(
            screen.getByRole("spinbutton", { name: "Drift alert violation threshold" }),
        )
        await user.type(
            screen.getByRole("spinbutton", { name: "Drift alert violation threshold" }),
            "1",
        )
        await user.click(screen.getByRole("checkbox", { name: "Drift alert channel email" }))
        await user.click(screen.getByRole("button", { name: "Save drift alert config" }))

        await waitFor(() => {
            expect(
                screen.getByText(/Drift alerts saved: severity critical, threshold 1/),
            ).not.toBeNull()
        })
        expect(screen.getByText(/channels: slack, email\./)).not.toBeNull()
    })

    it("валидирует и применяет architecture guardrails из YAML с visual rules preview", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))
        await waitFor(() => {
            expect(screen.getByText("Guardrails are valid")).not.toBeNull()
        })
        expect(screen.getByLabelText("Guardrail visual rules list")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Apply guardrails" }))
        await waitFor(() => {
            expect(
                screen.getByText(/Applied architecture guardrails with 3 rules\./),
            ).not.toBeNull()
        })
    })

    it("when apply contract clicked without validation, then shows apply blocked status", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.click(screen.getByRole("button", { name: "Apply validated contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Apply blocked: validate contract first.")).not.toBeNull()
        })
    })

    it("when blueprint has validation errors and apply is clicked, then shows apply blocked", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture blueprint yaml" }), {
            target: {
                value: "version: 1\nlayers:\n  - name: domain",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate blueprint" }))
        await waitFor((): void => {
            expect(screen.getByText("Blueprint validation errors")).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Apply blueprint" }))
        await waitFor((): void => {
            expect(
                screen.getByText("Apply blocked: fix blueprint validation issues first."),
            ).not.toBeNull()
        })
    })

    it("when guardrails yaml has errors and apply is clicked, then shows apply blocked", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n  - mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))
        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Apply guardrails" }))
        await waitFor((): void => {
            expect(
                screen.getByText("Apply blocked: fix guardrails validation issues first."),
            ).not.toBeNull()
        })
    })

    it("when all drift alert channels are unchecked, then save shows blocked status", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.click(screen.getByRole("checkbox", { name: "Drift alert channel slack" }))
        await user.click(screen.getByRole("button", { name: "Save drift alert config" }))

        await waitFor((): void => {
            expect(
                screen.getByText("Save blocked: select at least one notification channel."),
            ).not.toBeNull()
        })
    })

    it("when contract root is not an object, then shows validation error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: { value: '"just a string"' },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Contract root must be an object envelope.")).not.toBeNull()
    })

    it("when contract has unsupported version number, then shows version error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: {
                value: JSON.stringify({
                    schema: "codenautic.contract.v1",
                    version: 999,
                    type: "theme-library",
                    payload: {},
                }),
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Version 999 is not supported.")).not.toBeNull()
    })

    it("when contract has missing payload, then shows payload required error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: {
                value: JSON.stringify({
                    schema: "codenautic.contract.v1",
                    version: 1,
                    type: "theme-library",
                }),
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Payload is required.")).not.toBeNull()
    })

    it("when contract has invalid type, then shows type error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: {
                value: JSON.stringify({
                    schema: "codenautic.contract.v1",
                    version: 1,
                    type: "unknown-type",
                    payload: {},
                }),
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(
            screen.getByText('Type must be either "theme-library" or "rules-library".'),
        ).not.toBeNull()
    })

    it("when contract version is not a number, then shows version type error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: {
                value: JSON.stringify({
                    schema: "codenautic.contract.v1",
                    version: "abc",
                    type: "theme-library",
                    payload: {},
                }),
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Version is required and must be a number.")).not.toBeNull()
    })

    it("when sorting drift by severity ascending, then low severity violations appear first", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.selectOptions(screen.getByLabelText("Drift report sort mode"), "severity-asc")

        await waitFor((): void => {
            const _items = screen.getAllByRole("listitem")
            const driftList = screen.getByLabelText("Drift violations list").querySelectorAll("li")
            const firstItem = driftList[0]
            expect(firstItem?.textContent).toContain("low")
        })
    })

    it("when sorting drift by files ascending, then violations with fewest files appear first", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.selectOptions(screen.getByLabelText("Drift report sort mode"), "files-asc")

        await waitFor((): void => {
            const driftList = screen.getByLabelText("Drift violations list").querySelectorAll("li")
            const firstItem = driftList[0]
            expect(firstItem?.textContent).toContain("Naming drift in adapter boundary")
        })
    })

    it("when drift search matches no violations, then shows empty state alert", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.clear(screen.getByRole("textbox", { name: "Drift report search query" }))
        await user.type(
            screen.getByRole("textbox", { name: "Drift report search query" }),
            "zzz-nonexistent-query",
        )

        await waitFor((): void => {
            expect(screen.getByText("No drift violations found")).not.toBeNull()
        })
        expect(
            screen.getByText("Change filters or search query to see drift analysis data."),
        ).not.toBeNull()
    })

    it("when guardrails yaml has empty source, then shows source required error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n  - source:\n    target: domain\n    mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
    })

    it("when guardrails yaml has mode before source/target, then shows order error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n  - mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
        expect(
            screen.getByText(/guardrail rule must include source and target before mode/),
        ).not.toBeNull()
    })

    it("when guardrails yaml has invalid mode value, then shows mode error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n  - source: domain\n    target: infra\n    mode: block",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/mode must be allow or forbid/)).not.toBeNull()
    })

    it("when guardrails yaml has tabs, then shows tabs error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n\t- source: domain\n  target: infra\n  mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/tabs are not allowed, use spaces/)).not.toBeNull()
    })

    it("when guardrails yaml has unsupported field, then shows unsupported field error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n  - source: domain\n    target: infra\n    severity: high\n    mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/unsupported guardrail field/)).not.toBeNull()
    })

    it("when guardrails yaml has empty target, then shows target required error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "rules:\n  - source: domain\n    target:\n    mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/target is required/)).not.toBeNull()
    })

    it("when blueprint yaml has tabs, then shows tab error in validation", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture blueprint yaml" }), {
            target: {
                value: "version: 1\n\tlayers:\n  - name: domain\nrules:\n  - source: infra\n    target: domain\n    mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate blueprint" }))

        await waitFor((): void => {
            expect(screen.getByText("Blueprint validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/tabs are not allowed, use spaces/)).not.toBeNull()
    })

    it("when blueprint yaml has neither layers nor rules, then shows both missing errors", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture blueprint yaml" }), {
            target: {
                value: "version: 1\nmetadata: none",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate blueprint" }))

        await waitFor((): void => {
            expect(screen.getByText("Blueprint validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Blueprint must include `layers` section.")).not.toBeNull()
        expect(screen.getByText("Blueprint must include `rules` section.")).not.toBeNull()
    })

    it("when drift alert violation threshold is cleared, then defaults to zero", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        const thresholdInput = screen.getByRole("spinbutton", {
            name: "Drift alert violation threshold",
        })
        await user.clear(thresholdInput)

        expect((thresholdInput as HTMLInputElement).value).toBe("0")
    })

    it("when drift trend summary is displayed, then shows regression info", (): void => {
        renderWithProviders(<SettingsContractValidationPage />)

        expect(screen.getByText(/Current drift score: 41/)).not.toBeNull()
        expect(screen.getByText(/improvement vs baseline/)).not.toBeNull()
    })

    it("when blueprint yaml file is uploaded, then textarea updates with file content", async (): Promise<void> => {
        renderWithProviders(<SettingsContractValidationPage />)

        const uploadInput = screen.getByLabelText("Upload blueprint yaml")
        const yamlContent =
            "version: 2\nlayers:\n  - name: domain\nrules:\n  - source: infra\n    target: domain\n    mode: forbid"
        const file = new File([yamlContent], "blueprint.yaml", { type: "text/yaml" })

        fireEvent.change(uploadInput, { target: { files: [file] } })

        await waitFor((): void => {
            const textarea = screen.getByRole("textbox", {
                name: "Architecture blueprint yaml",
            })
            expect((textarea as HTMLInputElement).value).toContain("version: 2")
        })
    })

    it("when contract v2 is valid, then no migration hints are shown", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Contract json" }), {
            target: {
                value: JSON.stringify({
                    schema: "codenautic.contract.v1",
                    version: 2,
                    type: "rules-library",
                    payload: { items: [] },
                }),
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor((): void => {
            expect(screen.getByText("Contract is valid")).not.toBeNull()
        })
        expect(screen.queryByText("Migration hints")).toBeNull()
    })

    it("when toggling a drift alert channel off and on again, then channel is restored", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        const slackCheckbox = screen.getByRole("checkbox", {
            name: "Drift alert channel slack",
        })
        expect((slackCheckbox as HTMLInputElement).checked).toBe(true)

        await user.click(slackCheckbox)
        expect((slackCheckbox as HTMLInputElement).checked).toBe(false)

        await user.click(slackCheckbox)
        expect((slackCheckbox as HTMLInputElement).checked).toBe(true)
    })

    it("when blueprint yaml has invalid line without key-value pair, then shows expected error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture blueprint yaml" }), {
            target: {
                value: "version: 1\njusttext\nlayers:\n  - name: domain\nrules:\n  - source: infra\n    target: domain\n    mode: forbid",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate blueprint" }))

        await waitFor((): void => {
            expect(screen.getByText("Blueprint validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/expected key-value pair in YAML format/)).not.toBeNull()
    })

    it("when guardrails yaml has no rules at all, then shows at least one rule error", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        fireEvent.change(screen.getByRole("textbox", { name: "Architecture guardrails yaml" }), {
            target: {
                value: "# empty guardrails\nrules:",
            },
        })
        await user.click(screen.getByRole("button", { name: "Validate guardrails" }))

        await waitFor((): void => {
            expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        })
        expect(screen.getByText("Guardrails must include at least one rule.")).not.toBeNull()
    })
})
