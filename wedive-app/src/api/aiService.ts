import axios from 'axios';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  content: string;
  sessionId?: string;
  suggestions?: any[];
}

const API_BASE_URL = 'https://asia-northeast1-we-dive.cloudfunctions.net'; // Example URL

export const sendMessageToConcierge = async (
  query: string,
  token: string,
  sessionId?: string | null
): Promise<AiResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/getConciergeResponse`, {
      data: {
        query,
        sessionId
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.result;
  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
};
