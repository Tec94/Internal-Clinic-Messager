import 'dotenv/config';
import { chatCompletion, MODEL_ID } from './scripts/llm-client.mjs';

const apiKey = process.env.EXPLABS_API_KEY;
if (!apiKey) {
  console.error('❌ EXPLABS_API_KEY environment variable is not set.');
  console.error('Please create an API key under Settings -> API keys and export it as EXPLABS_API_KEY.');
  process.exit(1);
}

console.log('🔧 Connecting to Experiential gateway...');
console.log(`   Model: ${MODEL_ID}`);
console.log('');

async function testCall() {
  try {
    console.log('📤 Sending test message...');
    const response = await chatCompletion([
      { role: 'user', content: 'Say "Hello from Experiential!".' },
    ]);

    console.log('✅ Success! Response received.\n');
    console.log('📝 Reply:');
    console.log('─'.repeat(50));
    console.log(response.choices[0]?.message.content ?? 'No text returned.');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📊 Token Usage:');
    console.log(`   Prompt tokens:     ${response.usage?.prompt_tokens ?? 'unavailable'}`);
    console.log(`   Completion tokens: ${response.usage?.completion_tokens ?? 'unavailable'}`);
    console.log(`   Total tokens:      ${response.usage?.total_tokens ?? 'unavailable'}`);
    console.log('');
    console.log('✨ Test call completed successfully on your Experiential credits!');
  } catch (error) {
    console.error('❌ Error during test call:');
    // Provider error text can contain request data. Log only the HTTP status.
    if (typeof error?.status === 'number') console.error(`   Status: ${error.status}`);
    process.exit(1);
  }
}

testCall();
