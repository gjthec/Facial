import { AttendanceRecord, ClassSession } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const API_URL = "http://localhost:3000/api";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Validate Face using Google Gemini 2.5 Flash (Vision)
const validateFaceWithGemini = async (blob: Blob): Promise<void> => {
  try {
    const base64Image = await blobToBase64(blob);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We request a structured JSON response
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: `Analyze this image for a security check-in system. 
            I need to verify if there is a real human face suitable for identification.
            
            Strictly check for:
            1. Is there exactly ONE human face? (No groups, no empty shots).
            2. Is the face clearly visible? (Not too blurry, too dark, or too far away).
            3. Is the face unobstructed? (No masks, no hands covering the face).
            
            Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING, description: "User-friendly error message in Portuguese if invalid." }
          },
          required: ["isValid", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");

    if (!result.isValid) {
      throw new Error(result.reason || "Rosto não reconhecido. Tente novamente com mais luz.");
    }

  } catch (error: any) {
    console.error("Gemini Vision Error:", error);
    // Pass through the specific error message from the model or a default one
    throw new Error(error.message || "Falha na validação facial. Tente novamente.");
  }
};

export const api = {
  
  getClasses: async (token: string): Promise<ClassSession[]> => {
    // Simulação de resposta do backend
    await delay(500);
    const now = new Date();
    // Criando uma aula que está acontecendo AGORA para teste
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourBefore = new Date(now.getTime() - 60 * 60 * 1000);
    
    return [
      {
        id: "class_101",
        courseName: "Inteligência Artificial Aplicada",
        room: "Bloco C - Auditório",
        teacherName: "Prof. Dra. Mendes",
        startTime: oneHourBefore.toISOString(),
        endTime: oneHourLater.toISOString(), // Aula ativa agora
        isActive: true,
        allowedLocation: { lat: -23.5505, lng: -46.6333, radiusMeters: 30 }
      },
      {
        id: "class_102",
        courseName: "Ética em Computação",
        room: "Sala Virtual",
        teacherName: "Prof. Silva",
        startTime: "2023-12-01T10:00:00Z",
        endTime: "2023-12-01T12:00:00Z",
        isActive: false,
        allowedLocation: { lat: -23.5505, lng: -46.6333, radiusMeters: 30 }
      }
    ];
  },

  checkInWithFace: async (
    token: string, 
    classId: string, 
    lat: number, 
    lng: number,
    faceImageBlob: Blob
  ): Promise<AttendanceRecord> => {
    console.log(`[API] Enviando para validação Google Gemini Vision | Class: ${classId}`);

    // 1. Validação Inteligente com Google Gemini (Vision)
    await validateFaceWithGemini(faceImageBlob);

    // 2. Simular delay de processamento do registro no banco
    await delay(500);

    // 3. Simular validação de distância
    const simulateDistanceError = false; 
    if (simulateDistanceError) {
        throw new Error("Localização inválida. Você está a 45m da sala (max 30m).");
    }

    return {
      id: "audit_" + Date.now(),
      classId,
      studentId: "google-1029384756",
      checkInTime: new Date().toISOString(),
      checkInLocation: { lat, lng },
      status: 'present',
      livenessConfidence: 0.99, // Validado pelo Gemini
      faceId: "google-genai-verified",
    };
  },

  checkOut: async (token: string, recordId: string, lat: number, lng: number): Promise<AttendanceRecord> => {
    await delay(800);
    return {
      id: recordId,
      classId: "class_101",
      studentId: "google-1029384756",
      checkInTime: new Date().toISOString(), 
      checkInLocation: { lat, lng },
      checkOutTime: new Date().toISOString(),
      checkOutLocation: { lat, lng },
      status: 'completed'
    };
  }
};