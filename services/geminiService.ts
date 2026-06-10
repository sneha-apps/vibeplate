
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Recipe } from "../types";

/**
 * Step 1: Brainstorm potential supporting ingredients based on main items.
 */
export const generateSupportingIngredients = async (mainIngredients: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `The user has: ${mainIngredients}. 
    Think of a wide variety of supporting ingredients (spices, sauces, aromatics, oils) that could go with these. 
    Include items from various culinary traditions (Asian, Middle Eastern, African, etc.), not just Western ones. 
    Return a list of about 15-20 distinct items.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["suggestions"]
      }
    }
  });

  const data = JSON.parse(response.text || '{"suggestions": []}');
  return data.suggestions;
};

/**
 * Step 2: Generate the final recipe using ONLY the confirmed items.
 */
export const generateRecipe = async (mainIngredients: string, checkedItems: string[]): Promise<Recipe> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a gourmet recipe using ONLY these ingredients.
    Main Ingredients: ${mainIngredients}
    Supporting Ingredients Available: ${checkedItems.join(', ')}
    
    STRICT RULE: Do NOT include any ingredients in the recipe that are not in the lists above. 
    If you need a liquid, use water. If you need a fat and none is listed, use the most logical item from the available list or simplify the cooking method (e.g., steaming/roasting).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                amount: { type: Type.STRING }
              },
              required: ["item", "amount"]
            }
          },
          instructions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          nutrition: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.STRING },
              carbs: { type: Type.STRING },
              fat: { type: Type.STRING },
              fiber: { type: Type.STRING }
            },
            required: ["calories", "protein", "carbs", "fat", "fiber"]
          }
        },
        required: ["name", "description", "ingredients", "instructions", "nutrition"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateDishImage = async (dishName: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Professional food photography of ${dishName}. Minimalist, gourmet presentation, soft natural lighting, shallow depth of field. Clean Apple-style aesthetic. Ensure vivid colors and realistic textures.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate dish image");
};

export const generateAudioGuide = async (recipe: Recipe): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Read this recipe aloud in a helpful, calm, neutral English accent. 
  The recipe is called ${recipe.name}. 
  Description: ${recipe.description}. 
  Ingredients: ${recipe.ingredients.map(i => `${i.amount} of ${i.item}`).join(', ')}. 
  Instructions: ${recipe.instructions.join('. ')}.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio");
  return base64Audio;
};
