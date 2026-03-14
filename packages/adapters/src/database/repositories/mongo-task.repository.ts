import type {ITaskRepository} from "@codenautic/core"

import type {ITaskSchema} from "../schemas/task.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type TaskEntity = Parameters<ITaskRepository["save"]>[0]
type TaskIdentifier = Parameters<ITaskRepository["findById"]>[0]
type TaskStatus = Parameters<ITaskRepository["findByStatus"]>[0]

/**
 * Constructor options for Mongo task repository.
 */
export interface IMongoTaskRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<ITaskSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<TaskEntity, ITaskSchema>
}

/**
 * MongoDB implementation of task repository port.
 */
export class MongoTaskRepository implements ITaskRepository {
    private readonly model: IMongoModel<ITaskSchema>
    private readonly factory: IMongoRepositoryFactory<TaskEntity, ITaskSchema>

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoTaskRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds task by identifier.
     *
     * @param id Task identifier.
     * @returns Task or null.
     */
    public async findById(
        id: TaskIdentifier,
    ): ReturnType<ITaskRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Saves task entity with upsert semantics.
     *
     * @param task Task entity.
     */
    public async save(task: TaskEntity): ReturnType<ITaskRepository["save"]> {
        const document = this.factory.toDocument(task)
        await this.model.replaceOne(
            {
                _id: document._id,
            },
            document,
            {
                upsert: true,
            },
        )
    }

    /**
     * Finds tasks by lifecycle status.
     *
     * @param status Task status.
     * @returns Matched tasks.
     */
    public async findByStatus(
        status: TaskStatus,
    ): ReturnType<ITaskRepository["findByStatus"]> {
        const documents = await this.model.find({
            status,
        })

        return documents.map((document): TaskEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds tasks by task type.
     *
     * @param type Task type.
     * @returns Matched tasks.
     */
    public async findByType(
        type: string,
    ): ReturnType<ITaskRepository["findByType"]> {
        const documents = await this.model.find({
            type,
        })

        return documents.map((document): TaskEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds stale tasks by update timestamp.
     *
     * @param olderThan Cut-off timestamp.
     * @returns Matched stale tasks.
     */
    public async findStale(
        olderThan: Date,
    ): ReturnType<ITaskRepository["findStale"]> {
        const documents = await this.model.find({
            updatedAt: {
                $lt: olderThan,
            },
        })

        return documents.map((document): TaskEntity => {
            return this.factory.toEntity(document)
        })
    }
}
