// lib/llm/client.js
import Anthropic from 'anthropic';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY missing');
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Pick Haiku for ultra-low cost per our plan
export const MODEL = 'claude-3-5-haiku-latest';
