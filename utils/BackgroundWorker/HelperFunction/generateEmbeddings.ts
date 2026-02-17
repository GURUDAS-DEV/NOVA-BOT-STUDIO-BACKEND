import { OpenAI } from "openai/client.js";

export const generateEmbeddings = async (chunk: string[]): Promise<number[]> => {

    try {
        const validChunks = chunk.map((item) => item.trim()).filter((item) => item.length > 0);
        if (validChunks.length === 0) {
            throw new Error("No valid chunks provided for embedding generation");
        }

        const openai = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
        });

        const embeddingResponse = await openai.embeddings.create({
            model: "gemini-embedding-001",
            input: validChunks,
        }); 
        if(!embeddingResponse.data || embeddingResponse.data.length === 0 || !(embeddingResponse as any).data[0].embedding){
            throw new Error("Invalid response from embedding API");
        }

        return (embeddingResponse as any).data[0].embedding;
    }
    catch (e) {
        throw new Error(`Error while generating embeddings: ${e}`);
    }
}