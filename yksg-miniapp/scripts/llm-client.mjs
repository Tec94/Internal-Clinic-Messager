import process from 'node:process';
import OpenAI from 'openai';

export const EXPERIENTIAL_BASE_URL = 'https://api.experientiallabs.ai/v1';
export const MODEL_ID = 'gpt-6-astra';

// Local Node tooling only. Never accept a VITE_ key or enable browser requests.
export async function chatCompletion(messages, options = {}) {
  const apiKey = process.env.EXPLABS_API_KEY;
  if (!apiKey) throw new Error('EXPLABS_API_KEY is required for the local API check.');

  const client = new OpenAI({ baseURL: EXPERIENTIAL_BASE_URL, apiKey });
  const { stream = false, tools, maxTokens } = options;
  return client.chat.completions.create({
    model: MODEL_ID,
    messages,
    stream,
    ...(maxTokens !== undefined && { max_tokens: maxTokens }),
    ...(tools !== undefined && { tools }),
  });
}
