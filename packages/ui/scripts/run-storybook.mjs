import { spawn } from "node:child_process"
import path from "node:path"
import { exit, kill, pid } from "node:process"
import { fileURLToPath } from "node:url"

import { loadUiServicePorts } from "../config/service-ports.ts"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const packageDirectory = path.resolve(currentDirectory, "..")
const servicePorts = loadUiServicePorts(packageDirectory)
const storybookPort = servicePorts.storybook

const storybookProcess = spawn("bun", ["x", "storybook", "dev", "-p", String(storybookPort)], {
    cwd: packageDirectory,
    stdio: "inherit",
})

storybookProcess.on("error", (error) => {
    throw error
})

storybookProcess.on("exit", (code, signal) => {
    if (signal !== null) {
        kill(pid, signal)
        return
    }

    exit(code ?? 1)
})
