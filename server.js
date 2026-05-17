import express from 'express';
import { AiModeClient } from './aimodeClient.js';

const app = express();

app.use(express.json({
  limit: '2mb'
}));

app.use(express.static('public'));

const client = new AiModeClient({
  headless: process.env.HEADLESS !== 'false',
  userDataDir: process.env.USER_DATA_DIR || '/app/data/sessions/google-profile',
  locale: process.env.BROWSER_LOCALE || 'it-IT',
  timezoneId: process.env.BROWSER_TIMEZONE || 'Europe/Rome',
  userAgent: process.env.BROWSER_USER_AGENT || undefined
});

await client.init();

const apiSpec = {
  name: 'Google AI Mode API Wrapper',
  version: '0.1.0',
  endpoints: [
    {
      method: 'GET',
      path: '/health',
      description: 'Returns service status and browser environment configuration.'
    },
    {
      method: 'POST',
      path: '/chat/new',
      description: 'Creates a new AI Mode browser tab/session and returns a chatId.'
    },
    {
      method: 'POST',
      path: '/chat/:chatId/message',
      description: 'Sends a message to an existing chat and returns the latest assistant response.',
      body: {
        message: 'string'
      }
    },
    {
      method: 'GET',
      path: '/chat/:chatId/last',
      description: 'Returns the last parsed conversation item for a chat.'
    },
    {
      method: 'GET',
      path: '/chat/:chatId/all',
      description: 'Returns the full parsed conversation for a chat.'
    },
    {
      method: 'DELETE',
      path: '/chat/:chatId',
      description: 'Closes the browser tab associated with the chat and removes it from memory.'
    }
  ]
};

app.get('/api', (_req, res) => {
  res.json(apiSpec);
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    browserLocale: process.env.BROWSER_LOCALE || 'it-IT',
    browserTimezone: process.env.BROWSER_TIMEZONE || 'Europe/Rome',
    headless: process.env.HEADLESS !== 'false',
    userAgent: process.env.BROWSER_USER_AGENT || undefined
  });
});

app.post('/chat/new', async (_req, res) => {
  try {
    const result = await client.newChat();

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post('/chat/:chatId/message', async (req, res) => {
  try {
    const { chatId } = req.params;

    const { message } = req.body;

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'The "message" field must be a non-empty string'
      });
    }

    const result = await client.sendMessage(chatId, message);

    res.json({
      chatId,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/chat/:chatId/last', async (req, res) => {
  try {
    const { chatId } = req.params;

    const lastMessage = await client.readLastMessage(chatId);

    res.json({
      chatId,
      lastMessage
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/chat/:chatId/all', async (req, res) => {
  try {
    const { chatId } = req.params;

    const conversation = await client.readConversation(chatId);

    res.json({
      chatId,
      conversation
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.delete('/chat/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

    const result = await client.closeChat(chatId);

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Google AI Mode API Wrapper listening on port ${port}`);
});

async function shutdown() {
  console.log('Shutting down Google AI Mode API Wrapper...');

  try {
    await client.close();
  } catch (error) {
    console.error('Error during browser shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
