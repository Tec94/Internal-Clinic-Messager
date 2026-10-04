import OpenAI from 'openai';

export const EXPERIENTIAL_BASE_URL = 'https://api.experientiallabs.ai/v1';
export const MODEL_ID = 'gpt-6-astra';

function getApiKey(): string {
  // Support both Vite (import.meta.env) and Node (process.env) environments
  const viteKey = typeof import.meta !== 'undefined'
    ? (import.meta as any).env?.VITE_EXPLABS_API_KEY
    : undefined;
  const nodeKey = typeof process !== 'undefined'
    ? process.env?.EXPLABS_API_KEY
    : undefined;
  const apiKey = viteKey || nodeKey;

  if (!apiKey) {
    throw new Error(
      'EXPLABS_API_KEY environment variable is not set. ' +
      'Please create an API key under Settings -> API keys and export it as EXPLABS_API_KEY.'
    );
  }
  return apiKey;
}

export const llmClient = new OpenAI({
  baseURL: EXPERIENTIAL_BASE_URL,
  apiKey: getApiKey(),
  dangerouslyAllowBrowser: true,
});

export { MODEL_ID };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: {
    stream?: boolean;
    tools?: OpenAI.ChatCompletionTool[];
    maxTokens?: number;
  } = {}
): Promise<OpenAI.ChatCompletion | OpenAI.ChatCompletionStream> {
  const { stream = false, tools, maxTokens } = options;

  const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
    model: MODEL_ID,
    messages,
    ...(maxTokens && { max_tokens: maxTokens }),
    ...(tools && { tools }),
  };

  if (stream) {
    return llmClient.chat.completions.create({
      ...params,
      stream: true,
    } as OpenAI.ChatCompletionCreateParamsStreaming);
  }

  return llmClient.chat.completions.create(params);
}
