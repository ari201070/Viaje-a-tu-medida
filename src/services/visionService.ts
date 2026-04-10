import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface LodgingExtractionResult {
  name?: string;
  checkIn?: string;
  checkOut?: string;
  address?: string;
}

export interface TransportExtractionResult {
  type?: 'flight' | 'train' | 'bus' | 'car' | 'other';
  provider?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  reservationCode?: string;
}

export async function extractTransportReservation(file: File): Promise<TransportExtractionResult | null> {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: 'Analyze this transport/flight reservation document (image or PDF) and extract the following information in JSON format: 1. type: The type of transport (flight, train, bus, car, other). 2. provider: The airline or transport company name. 3. departureTime: The departure date and time in ISO format (YYYY-MM-DDTHH:mm). 4. arrivalTime: The arrival date and time in ISO format (YYYY-MM-DDTHH:mm). 5. departureLocation: The departure city, airport, or station. 6. arrivalLocation: The arrival city, airport, or station. 7. reservationCode: The PNR, booking reference, or confirmation code. If any information is missing, omit the field or return null for it.',
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: 'Type of transport: flight, train, bus, car, other' },
            provider: { type: Type.STRING, description: 'Airline or transport company name' },
            departureTime: { type: Type.STRING, description: 'Departure date and time in ISO format (YYYY-MM-DDTHH:mm)' },
            arrivalTime: { type: Type.STRING, description: 'Arrival date and time in ISO format (YYYY-MM-DDTHH:mm)' },
            departureLocation: { type: Type.STRING, description: 'Departure city, airport, or station' },
            arrivalLocation: { type: Type.STRING, description: 'Arrival city, airport, or station' },
            reservationCode: { type: Type.STRING, description: 'PNR, booking reference, or confirmation code' },
          },
        },
      },
    });

    let jsonStr = response.text?.trim() || '';
    if (jsonStr) {
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const result = JSON.parse(jsonStr) as TransportExtractionResult;
      // Ensure type is valid
      if (result.type && !['flight', 'train', 'bus', 'car', 'other'].includes(result.type)) {
        result.type = 'other';
      }
      return result;
    }
  } catch (error) {
    console.error('Error extracting transport reservation:', error);
  }
  return null;
}

export async function extractLodgingReservation(file: File): Promise<LodgingExtractionResult | null> {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64 = base64String.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: 'Analyze this lodging reservation document (image or PDF) and extract the following information in JSON format: 1. name: The name of the hotel or lodging. 2. checkIn: The check-in date and time in ISO format (YYYY-MM-DDTHH:mm). 3. checkOut: The check-out date and time in ISO format (YYYY-MM-DDTHH:mm). 4. address: The full address of the lodging. If any information is missing, omit the field or return null for it.',
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Name of the hotel or lodging' },
            checkIn: { type: Type.STRING, description: 'Check-in date and time in ISO format (YYYY-MM-DDTHH:mm)' },
            checkOut: { type: Type.STRING, description: 'Check-out date and time in ISO format (YYYY-MM-DDTHH:mm)' },
            address: { type: Type.STRING, description: 'Full address of the lodging' },
          },
        },
      },
    });

    let jsonStr = response.text?.trim() || '';
    if (jsonStr) {
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const result = JSON.parse(jsonStr) as LodgingExtractionResult;
      return result;
    }
  } catch (error) {
    console.error('Error extracting lodging reservation:', error);
  }
  return null;
}
export interface VisionAnalysisResult {
  landmarks: string[];
  texts: string[];
  labels: string[];
}

export async function analyzeImageWithVision(file: File): Promise<VisionAnalysisResult> {
  try {
    // Convert File to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data:image/jpeg;base64, part
        const base64 = base64String.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        },
        {
          text: 'Analyze this image and extract the following information in JSON format: 1. landmarks: A list of recognized landmarks or famous places (empty if none). 2. texts: A list of prominent text or signs visible in the image (empty if none). 3. labels: A list of general descriptive labels for the image content (e.g., "beach", "mountain", "cityscape", "food").',
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            landmarks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Recognized landmarks or famous places',
            },
            texts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Prominent text or signs visible in the image',
            },
            labels: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'General descriptive labels for the image content',
            },
          },
          required: ['landmarks', 'texts', 'labels'],
        },
      },
    });

    const jsonStr = response.text?.trim();
    if (jsonStr) {
      const result = JSON.parse(jsonStr) as VisionAnalysisResult;
      return result;
    }
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    console.error('Error analyzing image with Vision:', error);
  }

  return { landmarks: [], texts: [], labels: [] };
}

export async function reconcileLocation(
  lat: number | null,
  lng: number | null,
  address: string,
  visionData: VisionAnalysisResult
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          text: `You are an expert geographer and location reconciler.
I have a photo taken at coordinates: ${lat}, ${lng}.
The reverse geocoding address is: "${address}".
The visual analysis of the photo returned:
- Landmarks: ${visionData.landmarks.join(', ') || 'None'}
- Texts (OCR): ${visionData.texts.join(', ') || 'None'}
- Labels: ${visionData.labels.join(', ') || 'None'}

Based on this information, what is the most precise and accurate name of the specific place or point of interest (POI) where this photo was taken?
Return ONLY the name of the place, without any extra text, markdown, or explanation. If you cannot determine a specific place, return the most relevant street address or neighborhood.`,
        },
      ],
    });

    const result = response.text?.trim();
    return result || address;
  } catch (error) {
    console.error('Error reconciling location:', error);
    return address;
  }
}
