import { type ReactElement, useState } from "react"
import { useTranslation } from "react-i18next"

import { Alert, Button, Card, CardContent, CardHeader, Input, TextArea } from "@heroui/react"
import { FormLayout } from "@/components/forms/form-layout"
import { TYPOGRAPHY } from "@/lib/constants/typography"
import { showToastError, showToastInfo, showToastSuccess } from "@/lib/notifications/toast"

interface ISamlConfigState {
    /** SAML Entity ID (SP). */
    readonly entityId: string
    /** URL IdP SSO endpoint. */
    readonly ssoUrl: string
    /** X.509 certificate body. */
    readonly x509Certificate: string
}

interface IOidcConfigState {
    /** OIDC issuer URL. */
    readonly issuerUrl: string
    /** Client identifier. */
    readonly clientId: string
    /** Client secret (masked in UI). */
    readonly clientSecret: string
}

interface ISsoTestState {
    /** Провайдер теста. */
    readonly provider: "oidc" | "saml"
    /** Результат теста. */
    readonly status: "failed" | "passed"
    /** Сообщение результата. */
    readonly message: string
}

const INITIAL_SAML_CONFIG: ISamlConfigState = {
    entityId: "urn:codenautic:sp:acme",
    ssoUrl: "https://idp.acme.dev/sso/saml",
    x509Certificate: "-----BEGIN CERTIFICATE-----\nMIIC...acme...prod\n-----END CERTIFICATE-----",
}

const INITIAL_OIDC_CONFIG: IOidcConfigState = {
    clientId: "codenautic-web",
    clientSecret: "",
    issuerUrl: "https://auth.acme.dev/realms/platform",
}

function hasSamlRequiredConfig(config: ISamlConfigState): boolean {
    const hasEntityId = config.entityId.trim().length > 0
    const hasSsoUrl = config.ssoUrl.trim().startsWith("https://")
    const hasCertificate = config.x509Certificate.trim().length > 0

    return hasEntityId && hasSsoUrl && hasCertificate
}

function hasOidcRequiredConfig(config: IOidcConfigState): boolean {
    const hasIssuer = config.issuerUrl.trim().startsWith("https://")
    const hasClientId = config.clientId.trim().length > 0
    const hasClientSecret = config.clientSecret.trim().length >= 8

    return hasIssuer && hasClientId && hasClientSecret
}

function getMaskedSecret(secret: string, notConfiguredLabel: string): string {
    if (secret.trim().length === 0) {
        return notConfiguredLabel
    }

    return "••••••••"
}

/**
 * Страница управления SAML/OIDC настройками.
 *
 * @returns UI-конфигурация SSO с проверкой валидности и тестом подключения.
 */
export function SettingsSsoPage(): ReactElement {
    const { t } = useTranslation(["settings"])
    const [samlConfig, setSamlConfig] = useState<ISamlConfigState>(INITIAL_SAML_CONFIG)
    const [oidcConfig, setOidcConfig] = useState<IOidcConfigState>(INITIAL_OIDC_CONFIG)
    const [isSamlSaved, setIsSamlSaved] = useState(false)
    const [isOidcSaved, setIsOidcSaved] = useState(false)
    const [testState, setTestState] = useState<ISsoTestState | undefined>(undefined)

    const handleSaveSaml = (): void => {
        if (hasSamlRequiredConfig(samlConfig) !== true) {
            showToastError(t("settings:sso.toast.samlConfigInvalid"))
            return
        }

        setIsSamlSaved(true)
        showToastSuccess(t("settings:sso.toast.samlConfigSaved"))
    }

    const handleSaveOidc = (): void => {
        if (hasOidcRequiredConfig(oidcConfig) !== true) {
            showToastError(t("settings:sso.toast.oidcConfigInvalid"))
            return
        }

        setIsOidcSaved(true)
        showToastSuccess(t("settings:sso.toast.oidcConfigSaved"))
    }

    const handleTestSso = (provider: "oidc" | "saml"): void => {
        const isValid =
            provider === "saml"
                ? hasSamlRequiredConfig(samlConfig)
                : hasOidcRequiredConfig(oidcConfig)

        if (isValid) {
            const nextState: ISsoTestState = {
                message: t("settings:sso.toast.ssoTestPassedMessage", { provider }),
                provider,
                status: "passed",
            }
            setTestState(nextState)
            showToastSuccess(t("settings:sso.toast.ssoTestPassed"))
            return
        }

        const failedState: ISsoTestState = {
            message: t("settings:sso.toast.ssoTestFailedMessage", { provider }),
            provider,
            status: "failed",
        }
        setTestState(failedState)
        showToastInfo(t("settings:sso.toast.ssoTestFailed"))
    }

    return (
        <FormLayout
            title={t("settings:sso.pageTitle")}
            description={t("settings:sso.pageSubtitle")}
        >
            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <p className={TYPOGRAPHY.sectionTitle}>
                            {t("settings:sso.samlConfiguration")}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            aria-label={t("settings:sso.samlEntityId")}
                            placeholder="urn:codenautic:sp:acme"
                            value={samlConfig.entityId}
                            onChange={(e): void => {
                                setSamlConfig(
                                    (previous): ISamlConfigState => ({
                                        ...previous,
                                        entityId: e.target.value,
                                    }),
                                )
                            }}
                        />
                        <Input
                            aria-label={t("settings:sso.samlSsoUrl")}
                            placeholder="https://idp.acme.dev/sso/saml"
                            value={samlConfig.ssoUrl}
                            onChange={(e): void => {
                                setSamlConfig(
                                    (previous): ISamlConfigState => ({
                                        ...previous,
                                        ssoUrl: e.target.value,
                                    }),
                                )
                            }}
                        />
                        <TextArea
                            aria-label={t("settings:sso.x509Certificate")}
                            className="min-h-[120px]"
                            placeholder="-----BEGIN CERTIFICATE-----"
                            value={samlConfig.x509Certificate}
                            onChange={(e): void => {
                                setSamlConfig(
                                    (previous): ISamlConfigState => ({
                                        ...previous,
                                        x509Certificate: e.target.value,
                                    }),
                                )
                            }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="primary" onPress={handleSaveSaml}>
                                {t("settings:sso.saveSamlConfig")}
                            </Button>
                            <Button
                                variant="secondary"
                                onPress={(): void => {
                                    handleTestSso("saml")
                                }}
                            >
                                {t("settings:sso.testSsoSaml")}
                            </Button>
                        </div>
                        {isSamlSaved ? (
                            <Alert status="success">
                                <Alert.Title>{t("settings:sso.samlConfigSavedTitle")}</Alert.Title>
                                <Alert.Description>
                                    {t("settings:sso.samlConfigSavedDescription")}
                                </Alert.Description>
                            </Alert>
                        ) : null}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <p className={TYPOGRAPHY.sectionTitle}>
                            {t("settings:sso.oidcConfiguration")}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input
                            aria-label={t("settings:sso.oidcIssuerUrl")}
                            placeholder="https://auth.acme.dev/realms/platform"
                            value={oidcConfig.issuerUrl}
                            onChange={(e): void => {
                                setOidcConfig(
                                    (previous): IOidcConfigState => ({
                                        ...previous,
                                        issuerUrl: e.target.value,
                                    }),
                                )
                            }}
                        />
                        <Input
                            aria-label={t("settings:sso.oidcClientId")}
                            placeholder="codenautic-web"
                            value={oidcConfig.clientId}
                            onChange={(e): void => {
                                setOidcConfig(
                                    (previous): IOidcConfigState => ({
                                        ...previous,
                                        clientId: e.target.value,
                                    }),
                                )
                            }}
                        />
                        <Input
                            aria-label={t("settings:sso.oidcClientSecret")}
                            placeholder="client secret"
                            type="password"
                            value={oidcConfig.clientSecret}
                            onChange={(e): void => {
                                setOidcConfig(
                                    (previous): IOidcConfigState => ({
                                        ...previous,
                                        clientSecret: e.target.value,
                                    }),
                                )
                            }}
                        />
                        <p className="text-xs text-muted">
                            {t("settings:sso.secretPreview", {
                                preview: getMaskedSecret(
                                    oidcConfig.clientSecret,
                                    t("settings:sso.notConfigured"),
                                ),
                            })}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="primary" onPress={handleSaveOidc}>
                                {t("settings:sso.saveOidcConfig")}
                            </Button>
                            <Button
                                variant="secondary"
                                onPress={(): void => {
                                    handleTestSso("oidc")
                                }}
                            >
                                {t("settings:sso.testSsoOidc")}
                            </Button>
                        </div>
                        {isOidcSaved ? (
                            <Alert status="success">
                                <Alert.Title>{t("settings:sso.oidcConfigSavedTitle")}</Alert.Title>
                                <Alert.Description>
                                    {t("settings:sso.oidcConfigSavedDescription")}
                                </Alert.Description>
                            </Alert>
                        ) : null}
                    </CardContent>
                </Card>
            </div>

            {testState === undefined ? null : (
                <Alert status={testState.status === "passed" ? "success" : "warning"}>
                    <Alert.Title>
                        {testState.status === "passed"
                            ? t("settings:sso.connectivityCheckPassed")
                            : t("settings:sso.connectivityCheckFailed")}
                    </Alert.Title>
                    <Alert.Description>{testState.message}</Alert.Description>
                </Alert>
            )}
        </FormLayout>
    )
}
