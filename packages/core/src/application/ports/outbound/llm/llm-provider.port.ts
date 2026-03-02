import type {IChatRequestDTO, IChatResponseDTO, IStreamingChatResponseDTO} from "../../../dto/llm"

/**
 * Outbound contract for LLM provider integration.
 */
export interface ILLMProvider {
    /**
     * Executes chat completion request.
     *
     * @param request Chat request payload.
     * @returns Chat response payload.
     */
    chat(request: IChatRequestDTO): Promise<IChatResponseDTO>

    /**
     * Executes streaming chat completion request.
     *
     * @param request Chat request payload.
     * @returns Streaming chat response.
     */
    stream(request: IChatRequestDTO): IStreamingChatResponseDTO

    /**
     * Builds vector embeddings for text chunks.
     *
     * @param texts Source text chunks.
     * @returns Embedding vectors list.
     */
    embed(texts: readonly string[]): Promise<readonly number[][]>
}
