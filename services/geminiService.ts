import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ApiBook, Book } from '../types.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const bookSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    volumeInfo: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        authors: { type: Type.ARRAY, items: { type: Type.STRING } },
        publisher: { type: Type.STRING },
        publishedDate: { type: Type.STRING },
        description: { type: Type.STRING },
        pageCount: { type: Type.INTEGER },
        categories: { type: Type.ARRAY, items: { type: Type.STRING } },
        imageLinks: {
          type: Type.OBJECT,
          properties: {
            thumbnail: { type: Type.STRING },
          },
        },
      },
    },
  },
};

export const searchBooks = async (query: string): Promise<ApiBook[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search for books matching the query: "${query}". Return a list of up to 10 results. For each result, provide the id, title, authors, publisher, publishedDate, a brief description, pageCount, categories, and a thumbnail image link.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: bookSchema,
            },
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result.items || [];
  } catch (error) {
    console.error("Error searching books:", error);
    return [];
  }
};

export const generateBookCover = async (title: string, description: string): Promise<string> => {
  try {
    const prompt = `Generate a book cover for a book titled "${title}". The book's description is: "${description}". The cover should be visually appealing, artistic, and evocative of the book's themes. Avoid using any text on the cover.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
      }
    }
    throw new Error("No image data found in response.");

  } catch (error) {
    console.error("Error generating book cover:", error);
    throw error;
  }
};

export const searchBookCovers = async (query: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search the web for 5 high-quality book cover images for a book titled "${query}". Provide a list of publicly accessible, direct HTTPS image URLs. The URLs must point directly to an image file (e.g., .jpg, .png, .webp) and not a webpage. Ensure the images are not from sites with hotlinking protection and are suitable for direct embedding.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imageUrls: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["imageUrls"],
        },
      },
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result.imageUrls || [];
  } catch (error) {
    console.error("Error searching for book covers:", error);
    return [];
  }
};


export const askBookworm = async (query: string, library: Book[]): Promise<string> => {
  try {
    const libraryContext = library.length > 0
      ? `Here is the user's current library for context: ${JSON.stringify(library.map(b => ({ title: b.title, authors: b.authors, readingStatus: b.readingStatus, categories: b.categories, pageCount: b.pageCount, description: b.description.substring(0, 150) + '...' })))}`
      : "The user's library is currently empty.";

    const systemInstruction = `You are "Bookworm", a friendly and knowledgeable AI librarian assistant. Your purpose is to help users with all their book-related needs. You have access to the user's personal library collection for context.

If a user's query is about books they "own", "have", or if they ask for recommendations "from my library", you MUST use the provided library data below to answer.

For all other general questions, such as asking for new book recommendations, summaries of books not in their library, or author information, use your broader knowledge. Be friendly, concise, and helpful.

${libraryContext}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    
    return response.text;
  } catch (error) {
    console.error("Error asking Bookworm:", error);
    return "I'm sorry, I encountered an error. Please try again.";
  }
};