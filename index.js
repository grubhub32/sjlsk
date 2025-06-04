const { Client, IntentsBitField } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Replace these with your actual values
const GEMINI_API_KEY = 'AIzaSyAAh6wcuvNvwqIaol4M1Bws5IRYfBBrXJo';
const CHANNEL_ID = '1379589929474195570';
const TOKEN = 'MTM3OTYyODQ0NTcyMTU1OTIzMQ.GJE0Eu.QNsnZbEA_jzdF_kYgZw3cJpRmWt0vTO4e4ViY4';

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

client.on('ready', () => {
  console.log('The bot is online!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (message.content.startsWith('!')) return;
  
  // Only respond to @mentions of the bot
  if (!message.mentions.has(client.user)) return;
  
  try {
    await message.channel.sendTyping();
    
    // Remove the bot mention from the message
    let userMessage = message.content.replace(`<@${client.user.id}>`, '').trim();
    if (!userMessage) {
      message.reply("Hi there! You mentioned me but didn't say anything. How can I help you?");
      return;
    }
    
    // Get previous messages for context (only messages that mention the bot)
    let prevMessages = await message.channel.messages.fetch({ limit: 20 });
    prevMessages = prevMessages.reverse();
    
    // Build conversation history
    let conversationContext = 'You are a friendly Discord bot. Keep responses conversational and helpful.\n\nConversation history:\n';
    
    prevMessages.forEach((msg) => {
      if (msg.content.startsWith('!')) return;
      if (msg.author.bot && msg.author.id !== client.user.id) return;
      
      // Only include messages that mention the bot or are from the bot
      if (msg.mentions.has(client.user) || msg.author.id === client.user.id) {
        if (msg.author.id === client.user.id) {
          conversationContext += `Bot: ${msg.content}\n`;
        } else {
          let cleanMsg = msg.content.replace(`<@${client.user.id}>`, '').trim();
          conversationContext += `${msg.author.username}: ${cleanMsg}\n`;
        }
      }
    });
    
    conversationContext += `\nCurrent message from ${message.author.username}: ${userMessage}\n\nRespond naturally:`;
    
    // Call Gemini API with updated model name
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Updated model name
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: conversationContext }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 200,
      },
    });
    
    const response = await result.response;
    const responseText = response.text().trim();
    
    if (responseText) {
      message.reply(responseText);
    } else {
      message.reply("I'm not sure how to respond to that. Could you try rephrasing?");
    }
    
  } catch (error) {
    console.log(`ERR: ${error.message}`);
    console.log('Full error:', error);
    
    // More specific error handling
    let errorMessage;
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('401')) {
      errorMessage = "API key issue - please check the logs!";
      console.log('🔑 GEMINI API KEY ERROR - Check your API key!');
    } else if (error.message.includes('quota') || error.message.includes('429')) {
      errorMessage = "Rate limit exceeded - please wait a moment!";
      console.log('⏱️ QUOTA ERROR - Rate limit or quota exceeded!');
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      errorMessage = "Model not found - trying alternative model...";
      console.log('🤖 MODEL ERROR - Trying gemini-pro model...');
      
      // Fallback to try gemini-pro model
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const fallbackResult = await fallbackModel.generateContent(conversationContext);
        const fallbackResponse = await fallbackResult.response;
        const fallbackText = fallbackResponse.text().trim();
        
        if (fallbackText) {
          message.reply(fallbackText);
          return;
        }
      } catch (fallbackError) {
        console.log('Fallback model also failed:', fallbackError.message);
      }
      
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      errorMessage = "Network connection issue - check your internet!";
      console.log('🌐 NETWORK ERROR - Internet connection problem!');
    } else {
      errorMessage = `API Error: ${error.message}`;
      console.log('❓ UNKNOWN ERROR:', error.message);
    }
    
    message.reply(errorMessage);
  }
});

client.login(TOKEN);
