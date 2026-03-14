import { setupWorker } from "msw/browser"

import { handlers } from "./handlers"

/**
 * MSW browser worker для dev-режима.
 * Перехватывает HTTP-запросы к API и возвращает mock-ответы.
 */
export const worker = setupWorker(...handlers)
