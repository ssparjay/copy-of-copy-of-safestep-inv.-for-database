
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeScanData = async (query: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the following product scan query and provide insights or suggested improvements for warehouse metadata: "${query}"`,
    config: {
      systemInstruction: "You are an expert Warehouse Management System AI assistant. Help categorize and describe products based on fragments of data.",
    }
  });
  // Always return a string
  return response.text || "";
};

export const generateProductDescription = async (itemCode: string, category: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a professional warehouse description for a product with Item Code: ${itemCode} in the ${category} category.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          suggestedOutsole: { type: Type.STRING }
        },
        required: ["description", "suggestedOutsole"]
      }
    }
  });
  // Ensure we have a string to parse
  const text = response.text || '{"description": "", "suggestedOutsole": ""}';
  return JSON.parse(text);
};
