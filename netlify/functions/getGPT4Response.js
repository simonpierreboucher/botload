const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const { systemPrompt, userInput } = JSON.parse(event.body);

  const response = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      prompt: `${systemPrompt}\nUser: ${userInput}\nAssistant:`,
      max_tokens: 150
    })
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};

