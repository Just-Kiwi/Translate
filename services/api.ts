import { ApiRequestPayload, ApiResponse } from '../types';
import { API_BASE_URL } from '../constants';

export const processTranslation = async (payload: ApiRequestPayload): Promise<ApiResponse> => {
  try {
    const formData = new FormData();
    // Append the audio blob. We name it 'recording.wav' so the backend treats it as a file.
    formData.append('audio', payload.audio, 'recording.wav');
    formData.append('source_lang', payload.sourceLang);
    formData.append('target_lang', payload.targetLang);
    formData.append('return_audio_as', 'base64');

    // POST to the new FastAPI endpoint
    const response = await fetch(`${API_BASE_URL}/api/translate-audio`, {
      method: 'POST',
      body: formData, // Browser automatically sets Content-Type: multipart/form-data
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) errorMessage = errorData.detail;
      } catch (e) {
        // Fallback if JSON parsing fails
        const text = await response.text();
        if (text) errorMessage = text;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Construct the Data URL for the audio player using the base64 string from backend
    const audioUrl = `data:${data.audio_content_type || 'audio/wav'};base64,${data.audio_base64}`;

    return {
      transcript: data.transcript,
      translation: data.translated,
      audio: audioUrl,
      // Since the new API returns the final result directly, we provide a success log
      logs: "✅ Audio Transcribed\n✅ Translation Generated\n✅ Speech Synthesized"
    };

  } catch (error: any) {
    console.error("Translation Request Failed:", error);
    throw new Error(error.message || "Failed to connect to the server.");
  }
};