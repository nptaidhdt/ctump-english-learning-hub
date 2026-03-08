import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const extractVocabulary = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy trích xuất TẤT CẢ các từ vựng tiếng Anh quan trọng và thuật ngữ chuyên môn (khoảng 30-50 từ) từ nội dung sau đây. 
    Trả về danh sách các đối tượng JSON có: word (từ tiếng Anh), definition (nghĩa tiếng Việt), example (ví dụ tiếng Anh), translation (dịch ví dụ sang tiếng Việt).
    Nội dung: ${text.substring(0, 30000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            definition: { type: Type.STRING },
            example: { type: Type.STRING },
            translation: { type: Type.STRING },
          },
          required: ["word", "definition", "example", "translation"],
        },
      },
    },
  });
  return JSON.parse(response.text);
};

export const generateQuiz = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Dựa trên nội dung bài giảng sau, hãy tạo 25 câu hỏi trắc nghiệm tiếng Anh để kiểm tra kiến thức.
    Mỗi câu hỏi có: question (câu hỏi), options (mảng 4 lựa chọn), correctIndex (vị trí đáp án đúng 0-3), explanation (giải thích bằng tiếng Việt).
    Nội dung: ${text.substring(0, 5000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctIndex: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
          },
          required: ["question", "options", "correctIndex", "explanation"],
        },
      },
    },
  });
  return JSON.parse(response.text);
};

export const generateFillInBlanks = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Dựa trên nội dung bài giảng sau, hãy tạo 25 câu hỏi điền vào chỗ trống (fill-in-the-blank) để kiểm tra từ vựng.
    Mỗi câu hỏi có: sentence (câu có chỗ trống đánh dấu bằng [___]), missingWord (từ cần điền), hint (gợi ý bằng tiếng Việt).
    Nội dung: ${text.substring(0, 15000)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING },
            missingWord: { type: Type.STRING },
            hint: { type: Type.STRING },
          },
          required: ["sentence", "missingWord", "hint"],
        },
      },
    },
  });
  return JSON.parse(response.text);
};

export const evaluateWriting = async (prompt: string, studentText: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Đề bài: ${prompt}\nBài làm của sinh viên: ${studentText}\n
    Hãy chấm điểm bài viết này trên thang điểm 10 và nhận xét chi tiết về ngữ pháp, từ vựng và cách diễn đạt bằng tiếng Việt.
    Trả về JSON: { score: number, feedback: string }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ["score", "feedback"],
      },
    },
  });
  return JSON.parse(response.text);
};

export const evaluateSpeaking = async (targetText: string, transcript: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Câu mẫu: ${targetText}\nKết quả nhận diện giọng nói: ${transcript}\n
    Hãy so sánh và chấm điểm độ chính xác phát âm trên thang điểm 10. Nhận xét các lỗi sai nếu có bằng tiếng Việt.
    Trả về JSON: { score: number, feedback: string }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ["score", "feedback"],
      },
    },
  });
  return JSON.parse(response.text);
};

export const generateSpeakingSentences = async (vocabulary: any[]) => {
  const words = vocabulary.map(v => v.word).join(", ");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Dựa trên các từ vựng sau: ${words}, hãy tạo 5 câu mẫu tiếng Anh ngắn gọn, thông dụng để sinh viên luyện phát âm.
    Trả về JSON: { sentences: string[] }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentences: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["sentences"],
      },
    },
  });
  return JSON.parse(response.text).sentences;
};

export const generateListeningPassage = async (vocabulary: any[]) => {
  const words = vocabulary.map(v => v.word).join(", ");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Hãy viết một đoạn văn ngắn (khoảng 50-80 từ) bằng tiếng Anh sử dụng các từ vựng sau: ${words}. 
    Đoạn văn nên tự nhiên, dễ hiểu và phù hợp cho việc luyện nghe.
    Đồng thời tạo 3 câu hỏi trắc nghiệm để kiểm tra mức độ hiểu bài nghe này.
    Trả về JSON: { 
      passage: string, 
      title: string, 
      questions: Array<{ question: string, options: string[], correctIndex: number }> 
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          passage: { type: Type.STRING },
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.NUMBER },
              },
              required: ["question", "options", "correctIndex"],
            },
          },
        },
        required: ["passage", "title", "questions"],
      },
    },
  });
  return JSON.parse(response.text);
};

export const generateTTS = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this passage clearly for a listening exercise: ${text}` }] }],
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
  if (base64Audio) {
    // Gemini TTS returns raw PCM audio (16-bit, mono, 24kHz).
    // We need to add a WAV header so the browser can play it.
    const sampleRate = 24000;
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const wavHeader = new Uint8Array(44);
    const view = new DataView(wavHeader.buffer);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + len, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 = PCM)
    view.setUint16(20, 1, true);
    // channel count (1 = Mono)
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, len, true);

    const combined = new Uint8Array(44 + len);
    combined.set(wavHeader);
    combined.set(bytes, 44);

    const blob = new Blob([combined], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }
  throw new Error("Failed to generate audio");
};
