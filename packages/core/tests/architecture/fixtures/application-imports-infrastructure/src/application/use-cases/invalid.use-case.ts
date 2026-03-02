import {queryDatabase} from "../../infrastructure/database/query.client"

export function executeUseCase(): string {
    return queryDatabase()
}
