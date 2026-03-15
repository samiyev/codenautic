import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ChangeEvent, FormEvent, ReactElement } from "react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import {
    Button,
    Checkbox,
    Input,
    ListBox,
    ListBoxItem,
    Radio,
    RadioGroup,
    Select,
    Switch,
    TextArea as Textarea,
} from "@heroui/react"
import { Eye, EyeOff } from "@/components/icons/app-icons"

import { renderWithProviders } from "../utils/render"

interface IFormValues {
    description: string
    email: string
    enableFeature: boolean
    issueLimit: number
    mode: "relaxed" | "strict"
    password: string
    provider: string
    sendNotifications: boolean
}

interface ITextFieldHarnessProps {
    readonly onSubmit: (values: IFormValues) => void
}

function TextFieldHarness(props: ITextFieldHarnessProps): ReactElement {
    const form = useForm<IFormValues>({
        defaultValues: {
            description: "",
            email: "",
            enableFeature: false,
            issueLimit: 1,
            mode: "relaxed",
            password: "",
            provider: "openai",
            sendNotifications: false,
        },
    })

    const submitForm = (event: FormEvent<HTMLFormElement>): void => {
        void form.handleSubmit((values): void => {
            props.onSubmit(values)
        })(event)
    }

    return (
        <form onSubmit={submitForm}>
            <Controller<IFormValues, "email">
                control={form.control}
                name="email"
                rules={{
                    minLength: {
                        message: "Минимум 6 символов",
                        value: 6,
                    },
                    required: "Обязательное поле",
                }}
                render={({ field, fieldState }): ReactElement => {
                    const errorMessage =
                        typeof fieldState.error?.message === "string"
                            ? fieldState.error.message
                            : undefined
                    const hasError = errorMessage !== undefined
                    const value = typeof field.value === "string" ? field.value : ""

                    return (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="email">Email</label>
                            <Input
                                aria-invalid={hasError}
                                aria-label="Email"
                                id="email"
                                name={field.name}
                                value={value}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                            />
                            {hasError ? (
                                <p className="text-xs text-danger" role="alert">
                                    {errorMessage}
                                </p>
                            ) : (
                                <p className="text-xs text-muted">
                                    Введите корпоративный email
                                </p>
                            )}
                        </div>
                    )
                }}
            />
            <Button type="submit">Отправить</Button>
        </form>
    )
}

interface IPasswordHarnessProps {
    readonly passwordDefault: string
}

function PasswordHarness(props: IPasswordHarnessProps): ReactElement {
    const form = useForm<IFormValues>({
        defaultValues: {
            description: "",
            email: "",
            enableFeature: false,
            issueLimit: 1,
            mode: "relaxed",
            password: props.passwordDefault,
            provider: "openai",
            sendNotifications: false,
        },
    })
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)

    return (
        <Controller<IFormValues, "password">
            control={form.control}
            name="password"
            render={({ field, fieldState }): ReactElement => {
                const hasError = fieldState.error?.message !== undefined
                const value = field.value === undefined ? "" : field.value

                return (
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="password">Password</label>
                        <div className="relative">
                            <Input
                                aria-label="Password"
                                aria-invalid={hasError}
                                className="pe-10"
                                id="password"
                                minLength={8}
                                name={field.name}
                                placeholder="••••••••"
                                type={isPasswordVisible ? "text" : "password"}
                                value={value}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                            />
                            <Button
                                aria-label={
                                    isPasswordVisible
                                        ? "Hide password text"
                                        : "Show password text"
                                }
                                className="absolute right-1 top-1/2 -translate-y-1/2"
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                onPress={(): void => {
                                    setIsPasswordVisible(
                                        (previousValue: boolean): boolean =>
                                            !previousValue,
                                    )
                                }}
                            >
                                {isPasswordVisible ? (
                                    <Eye size={16} />
                                ) : (
                                    <EyeOff size={16} />
                                )}
                            </Button>
                        </div>
                    </div>
                )
            }}
        />
    )
}

interface IFormSubmitCaptureProps {
    readonly onSubmit: (values: IFormValues) => void
}

function FullFormHarness(props: IFormSubmitCaptureProps): ReactElement {
    const form = useForm<IFormValues>({
        defaultValues: {
            description: "",
            email: "",
            enableFeature: false,
            issueLimit: 1,
            mode: "relaxed",
            password: "",
            provider: "openai",
            sendNotifications: false,
        },
    })
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)

    const submitForm = (event: FormEvent<HTMLFormElement>): void => {
        void form.handleSubmit((values): void => {
            props.onSubmit(values)
        })(event)
    }

    return (
        <form onSubmit={submitForm}>
            <Controller<IFormValues, "email">
                control={form.control}
                name="email"
                rules={{
                    pattern: {
                        message: "Неверный формат email",
                        value: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
                    },
                    required: "Email обязателен",
                }}
                render={({ field, fieldState }): ReactElement => {
                    const hasError = fieldState.error?.message !== undefined
                    const value = typeof field.value === "string" ? field.value : ""

                    return (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="email">Email</label>
                            <Input
                                aria-label="Email"
                                aria-invalid={hasError}
                                id="email"
                                name={field.name}
                                value={value}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                            />
                            <p className="text-xs text-muted">Корпоративный email</p>
                        </div>
                    )
                }}
            />
            <Controller<IFormValues, "password">
                control={form.control}
                name="password"
                rules={{
                    minLength: {
                        message: "Пароль слишком короткий",
                        value: 8,
                    },
                    required: "Пароль обязателен",
                }}
                render={({ field, fieldState }): ReactElement => {
                    const hasError = fieldState.error?.message !== undefined
                    const value = field.value === undefined ? "" : field.value

                    return (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="password">Password</label>
                            <div className="relative">
                                <Input
                                    aria-label="Password"
                                    aria-invalid={hasError}
                                    className="pe-10"
                                    id="password"
                                    minLength={8}
                                    name={field.name}
                                    placeholder="••••••••"
                                    type={isPasswordVisible ? "text" : "password"}
                                    value={value}
                                    onBlur={field.onBlur}
                                    onChange={field.onChange}
                                />
                                <Button
                                    aria-label={
                                        isPasswordVisible
                                            ? "Hide password text"
                                            : "Show password text"
                                    }
                                    className="absolute right-1 top-1/2 -translate-y-1/2"
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    onPress={(): void => {
                                        setIsPasswordVisible(
                                            (previousValue: boolean): boolean =>
                                                !previousValue,
                                        )
                                    }}
                                >
                                    {isPasswordVisible ? (
                                        <Eye size={16} />
                                    ) : (
                                        <EyeOff size={16} />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )
                }}
            />
            <Controller<IFormValues, "description">
                control={form.control}
                name="description"
                rules={{ required: "Описание обязательно" }}
                render={({ field, fieldState }): ReactElement => {
                    const hasError = fieldState.error?.message !== undefined
                    const value = field.value === undefined ? "" : field.value

                    return (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="description">Описание</label>
                            <Textarea
                                aria-label="Описание"
                                aria-invalid={hasError}
                                id="description"
                                name={field.name}
                                value={value}
                                onBlur={field.onBlur}
                                onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
                                    field.onChange(event.target.value)
                                }}
                            />
                        </div>
                    )
                }}
            />
            <Controller<IFormValues, "provider">
                control={form.control}
                name="provider"
                rules={{ required: "Выберите поставщика" }}
                render={({ field, fieldState }): ReactElement => {
                    const hasError = fieldState.error?.message !== undefined
                    const selectedKey =
                        field.value === undefined ? null : String(field.value)

                    return (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="provider">Поставщик</label>
                            <Select
                                aria-label="Поставщик"
                                aria-invalid={hasError}
                                name={field.name}
                                id="provider"
                                selectedKey={selectedKey}
                                onSelectionChange={(key): void => {
                                    const nextValue =
                                        typeof key === "string" ? key : undefined
                                    field.onChange(nextValue)
                                }}
                            >
                                <Select.Trigger>
                                    <Select.Value />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        <ListBoxItem
                                            key="openai"
                                            id="openai"
                                            textValue="OpenAI"
                                        >
                                            <div className="flex flex-col">
                                                <span>OpenAI</span>
                                            </div>
                                        </ListBoxItem>
                                        <ListBoxItem
                                            key="anthropic"
                                            id="anthropic"
                                            textValue="Anthropic"
                                        >
                                            <div className="flex flex-col">
                                                <span>Anthropic</span>
                                            </div>
                                        </ListBoxItem>
                                        <ListBoxItem
                                            key="ollama"
                                            id="ollama"
                                            textValue="Ollama"
                                        >
                                            <div className="flex flex-col">
                                                <span>Ollama</span>
                                                <span className="text-xs text-muted">
                                                    Локальная модель
                                                </span>
                                            </div>
                                        </ListBoxItem>
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        </div>
                    )
                }}
            />
            <Controller<IFormValues, "issueLimit">
                control={form.control}
                name="issueLimit"
                rules={{
                    min: {
                        message: "Лимит не может быть меньше 1",
                        value: 1,
                    },
                    required: "Лимит обязателен",
                }}
                render={({ field, fieldState }): ReactElement => {
                    const hasError = fieldState.error?.message !== undefined
                    const value =
                        field.value === undefined ? "" : String(field.value)

                    return (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="issueLimit">Лимит задач</label>
                            <Input
                                aria-label="Лимит задач"
                                aria-invalid={hasError}
                                id="issueLimit"
                                inputMode="decimal"
                                min={1}
                                name={field.name}
                                placeholder="0"
                                type="number"
                                value={value}
                                onBlur={field.onBlur}
                                onChange={(
                                    event: ChangeEvent<HTMLInputElement>,
                                ): void => {
                                    const nextValue = event.target.value

                                    if (nextValue === "") {
                                        field.onChange(undefined)
                                        return
                                    }

                                    const parsedNumber = Number(nextValue)
                                    if (Number.isNaN(parsedNumber) === true) {
                                        field.onChange(undefined)
                                        return
                                    }

                                    field.onChange(parsedNumber)
                                }}
                            />
                        </div>
                    )
                }}
            />
            <Controller<IFormValues, "enableFeature">
                control={form.control}
                name="enableFeature"
                render={({ field }): ReactElement => (
                    <Checkbox
                        aria-label="Включить функцию"
                        isSelected={field.value === true}
                        name={field.name}
                        onChange={field.onChange}
                    >
                        Включить функцию
                    </Checkbox>
                )}
            />
            <Controller<IFormValues, "sendNotifications">
                control={form.control}
                name="sendNotifications"
                render={({ field }): ReactElement => (
                    <Switch
                        aria-label="Уведомления"
                        name={field.name}
                        isSelected={field.value === true}
                        onChange={field.onChange}
                    >
                        Уведомления
                    </Switch>
                )}
            />
            <Controller<IFormValues, "mode">
                control={form.control}
                name="mode"
                rules={{ required: "Выберите режим" }}
                render={({ field, fieldState }): ReactElement => {
                    const hasError = fieldState.error?.message !== undefined

                    return (
                        <div className="flex flex-col gap-1.5">
                            <span>Режим</span>
                            <RadioGroup
                                aria-label="Режим"
                                aria-invalid={hasError}
                                name={field.name}
                                value={field.value ?? ""}
                                onChange={(value: string): void => {
                                    field.onChange(value)
                                }}
                            >
                                <Radio key="strict" value="strict">
                                    Строгий
                                </Radio>
                                <Radio key="relaxed" value="relaxed">
                                    Свободный
                                </Radio>
                            </RadioGroup>
                        </div>
                    )
                }}
            />
            <Button type="submit">Сохранить</Button>
        </form>
    )
}

describe("form components", (): void => {
    it("валидирует текстовое поле и отправляет данные формы", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()

        renderWithProviders(<TextFieldHarness onSubmit={onSubmit} />)

        const emailInput = screen.getByRole("textbox", { name: "Email" })
        const submitButton = screen.getByRole("button", { name: "Отправить" })

        await user.type(emailInput, "bad")
        await user.click(submitButton)

        expect(screen.queryByText("Минимум 6 символов")).not.toBeNull()
        expect(onSubmit).not.toHaveBeenCalled()

        await user.clear(emailInput)
        await user.type(emailInput, "alice@example.com")
        await user.click(submitButton)

        await waitFor((): void => {
            expect(screen.queryByText("Минимум 6 символов")).toBeNull()
        })
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("переключает видимость пароля в password field", async (): Promise<void> => {
        const user = userEvent.setup()

        renderWithProviders(<PasswordHarness passwordDefault="initial-pass" />)

        const input = screen.getByLabelText<HTMLInputElement>("Password")
        const showButton = screen.getByRole("button", { name: "Show password text" })

        expect(input.type).toBe("password")
        expect(input.value).toBe("initial-pass")

        await user.click(showButton)
        expect(screen.queryByRole("button", { name: "Hide password text" })).not.toBeNull()
        expect(input.type).toBe("text")

        await user.click(screen.getByRole("button", { name: "Hide password text" }))
        expect(screen.queryByRole("button", { name: "Show password text" })).not.toBeNull()
        expect(input.type).toBe("password")
    })

    it("обрабатывает полный набор формы и отправляет значения", async (): Promise<void> => {
        const user = userEvent.setup()
        let submittedValues: IFormValues | undefined

        renderWithProviders(
            <FullFormHarness
                onSubmit={(values): void => {
                    submittedValues = values
                }}
            />,
        )

        const descriptionInput = screen.getByRole("textbox", { name: "Описание" })
        const emailInput = screen.getByRole("textbox", { name: "Email" })
        const passwordInput = screen.getByLabelText<HTMLInputElement>("Password")
        const issueLimitInput = screen.getByRole("spinbutton", {
            name: "Лимит задач",
        })
        const featureCheckbox = screen.getByRole("checkbox", { name: "Включить функцию" })
        const notificationsSwitch = screen.getByRole("switch", { name: "Уведомления" })
        const strictModeRadio = screen.getByRole("radio", { name: "Строгий" })
        const submitButton = screen.getByRole("button", { name: "Сохранить" })

        await user.type(emailInput, "bad")
        await user.type(passwordInput, "short")
        await user.type(descriptionInput, "Описание")
        await user.clear(issueLimitInput)
        await user.type(issueLimitInput, "5")
        await user.click(featureCheckbox)
        await user.click(notificationsSwitch)
        await user.click(strictModeRadio)
        await user.click(submitButton)

        expect(submittedValues).toBeUndefined()

        await user.clear(emailInput)
        await user.type(emailInput, "alice@example.com")
        await user.clear(passwordInput)
        await user.type(passwordInput, "long-password")
        await user.click(submitButton)

        await waitFor((): void => {
            expect(submittedValues).not.toBeUndefined()
        })
        expect(submittedValues).toMatchObject({
            description: "Описание",
            email: "alice@example.com",
            enableFeature: true,
            issueLimit: 15,
            mode: "strict",
            password: "long-password",
            provider: "openai",
            sendNotifications: true,
        })
    })

    it("показывает disabled-состояние на submit-кнопке", (): void => {
        renderWithProviders(
            <form>
                <Button aria-busy={true} isDisabled={true} type="submit">
                    Сохранить
                </Button>
            </form>,
        )

        const button = screen.getByRole<HTMLButtonElement>("button", {
            name: "Сохранить",
        })
        expect(
            button.hasAttribute("disabled") || button.getAttribute("data-disabled") === "true",
        ).toBe(true)
    })
})
