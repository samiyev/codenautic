import path from "path"

import type { StorybookConfig } from "@storybook/react-vite"

import { loadUiServicePorts } from "../config/service-ports"

const servicePorts = loadUiServicePorts(__dirname)

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)", "../src/**/*.story.@(js|jsx|ts|tsx)"],
    addons: ["@storybook/addon-essentials", "@storybook/addon-a11y", "@storybook/addon-themes"],
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    docs: {
        autodocs: "tag",
    },
    staticDirs: ["../public"],
    viteFinal(config) {
        return {
            ...config,
            resolve: {
                ...(config.resolve ?? {}),
                alias: {
                    ...(config.resolve?.alias ?? {}),
                    "@": path.resolve(__dirname, "../src"),
                },
            },
            define: {
                ...(config.define ?? {}),
                __CODENAUTIC_UI_PORT__: JSON.stringify(servicePorts.ui),
                __CODENAUTIC_API_PORT__: JSON.stringify(servicePorts.api),
                __CODENAUTIC_UI_PREVIEW_PORT__: JSON.stringify(servicePorts.uiPreview),
                __CODENAUTIC_STORYBOOK_PORT__: JSON.stringify(servicePorts.storybook),
            },
        }
    },
}

export default config
