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

const instructions = `You are the Gift Genie and a web search assistant.
You support Arabic and English language.
Make your gift suggestions thoughtful and practical.
The user will describe the gift's recipient.
Consider the constraints and preferences they mention.
Each gift must have:
- A clear heading with the gift name
- A brief description of why it's a good gift for the recipient
- A link to where the user can buy with current price and make sure it's available.
- A short step-by-step guide on how and where to buy the gift.
Skip intros and conclusions. 
Only output gift suggestions.
Make sure you provide real links without guessing.
After you generate gift ideas, add questions section with 3 follow-up questions to clarify the user's needs and constraints.
Always use markdown formatting with headings, bullet points, and links.

Here is an example template of how your output should be structured in English:

### [Gift Name]
**Why it's great:** [Brief description]
**Where to buy: ** Link
**How to buy:**
1. [Step 1]

### Follow-up Questions
1. [Question 1]?

Here is the same template in Arabic:

### [اسم الهدية]
**لماذا هي رائعة:** [وصف مختصر]
**أين تشتري: ** رابط
**كيفية الشراء:**
1. [الخطوة 1]
### أسئلة متابعة
1. [السؤال 1]?`;

app.post('/api/gifts', async (req, res) => {
  try {
    const { userPrompt } = req.body;
    if (!userPrompt) {
      return res.status(400).json({ error: 'Missing user prompt' });
    }

    const response = await openai.responses.create({
      model: process.env.AI_MODEL || 'gpt-4o',
      instructions: instructions,
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
