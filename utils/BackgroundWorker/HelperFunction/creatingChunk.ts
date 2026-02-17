export const creatingChunk = (text: string, chunkSize: number = 1000, overlap: number = 200): string[] => {

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) { 
        const end = start + chunkSize;
        const chunk = text.slice(start, end);

        chunks.push(chunk.trim());

        start += chunkSize - overlap; 
    }


    return chunks;
}