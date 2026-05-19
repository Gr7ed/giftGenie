import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

function checkEnvironment() {
  if (!process.env.AI_URL) {
    throw new Error(
      "Missing AI_URL. This tells us which AI provider you're using."
    );
  }
  if (!process.env.AI_MODEL) {
    throw new Error("Missing AI_MODEL. The AI request needs a model name.");
  }
  if (!process.env.AI_KEY) {
    throw new Error("Missing AI_KEY. Your API key is not being picked up.");
  }
  if (!process.env.AI_INSTRUCTIONS) {
    throw new Error("Missing AI_INSTRUCTIONS. The AI request needs system instructions.");
  }
  console.log("AI provider URL:", process.env.AI_URL);
  console.log("AI model:", process.env.AI_MODEL);
}
checkEnvironment();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.AI_KEY,
  baseURL: process.env.AI_URL,
});

app.post('/api/gifts', async (req, res) => {
  try {
    const { userPrompt } = req.body;
    if (!userPrompt) {
      return res.status(400).json({ error: 'Missing user prompt' });
    }

    const response = await openai.responses.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      instructions: process.env.AI_INSTRUCTIONS,
      input: userPrompt,
      tools: [{ type: 'web_search' }],
      stream: true
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of response) {
      let content = '';
      if (typeof chunk.delta === 'string') {
        content = chunk.delta;
      } else {
        content = chunk.choices?.[0]?.delta?.content || chunk.delta?.content || chunk.delta?.text || '';
      }
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    res.status(500).json({ error: 'Failed to fetch AI response' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
