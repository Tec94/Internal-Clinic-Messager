import 'dotenv/config';
import OpenAI from 'openai';

const EXPERIENTIAL_BASE_URL = 'https://api.experientiallabs.ai/v1';
const MODEL_ID = 'gpt-6-astra';

const apiKey = process.env.EXPLABS_API_KEY;
if (!apiKey) {
  console.error('❌ EXPLABS_API_KEY environment variable is not set.');
  console.error('Please create an API key under Settings -> API keys and export it as EXPLABS_API_KEY.');
  process.exit(1);
}

console.log('🔧 Connecting to Experiential gateway...');
console.log(`   Base URL: ${EXPERIENTIAL_BASE_URL}`);
console.log(`   Model: ${MODEL_ID}`);
console.log(`   API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
console.log('');

const client = new OpenAI({
  baseURL: EXPERIENTIAL_BASE_URL,
  apiKey,
});

async function testCall() {
  try {
    console.log('📤 Sending test message...');
    const response = await client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: 'user', content: 'Say "Hello from Experiential!" and confirm you are gpt-6-astra.' }
      ],
    });

    console.log('✅ Success! Response received.\n');
    console.log('📝 Reply:');
    console.log('─'.repeat(50));
    console.log(response.choices[0].message.content);
    console.log('─'.repeat(50));
    console.log('');
    console.log('📊 Token Usage:');
    console.log(`   Prompt tokens:     ${response.usage.prompt_tokens}`);
    console.log(`   Completion tokens: ${response.usage.completion_tokens}`);
    console.log(`   Total tokens:      ${response.usage.total_tokens}`);
    console.log('');
    console.log('✨ Test call completed successfully on your Experiential credits!');
  } catch (error) {
    console.error('❌ Error during test call:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if ('status' in error) {
        console.error(`   Status: ${error.status}`);
      }
    }
    process.exit(1);
  }
}

testCall();
