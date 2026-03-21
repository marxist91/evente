import { GoogleGenAI, Type, Modality } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
};

export const generateEventPoster = async (prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [{ text: `Create a vibrant event poster for a cultural event in Togo. Theme: ${prompt}. Include traditional Togolese patterns and modern party vibes.` }],
    },
    config: {
      imageConfig: {
        aspectRatio: "3:4",
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const getEventsInfo = async (city: string, query: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Tu es un guide local expert de ${city} au Togo. L'utilisateur demande : "${query}".
    
    Tu dois chercher sur le web de manière EXHAUSTIVE pour trouver le maximum de lieux ou événements actuels qui correspondent.
    Trouve au moins 8 à 10 lieux ou événements différents si possible. Ne te limite pas à 2 ou 3.
    Pour chaque lieu, tu DOIS trouver une VRAIE image (affiche, photo du lieu, logo) en cherchant sur leurs réseaux sociaux, sites web ou annuaires.
    
    Réponds UNIQUEMENT avec un bloc de code JSON valide, sans aucun texte autour.
    Format attendu :
    {
      "message": "Ton message d'introduction amical et naturel",
      "places": [
        {
          "name": "Nom du lieu ou de l'événement",
          "description": "Description de ce qu'on y trouve et pourquoi c'est bien",
          "imageUrl": "URL directe vers une vraie image (ex: https://.../image.jpg). Cherche bien une vraie image !",
          "mapsUrl": "URL Google Maps du lieu (si disponible)"
        }
      ]
    }`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "";
  let parsedData = { message: text, places: [] };
  
  try {
    const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
    const jsonStr = match ? match[1] : text;
    parsedData = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI JSON:", text);
    parsedData.message = text;
  }

  return {
    text: parsedData.message,
    places: parsedData.places || [],
    grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks
  };
};

export const generateVeoVideo = async (imageBytes: string, prompt: string) => {
  const ai = getAI();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt || 'Animate this cultural moment in Togo with vibrant colors and movement',
    image: {
      imageBytes: imageBytes.split(',')[1], // Remove data:image/png;base64,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Failed to generate video");

  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey!,
    },
  });

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
