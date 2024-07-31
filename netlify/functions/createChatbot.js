const fetch = require('node-fetch');
const archiver = require('archiver');
const streamBuffers = require('stream-buffers');

exports.handler = async (event, context) => {
  const { title, systemPrompt, headerColor, botColor, userColor, buttonColor } = JSON.parse(event.body);

  const botPageHtml = generateChatbotHtml({ title, systemPrompt, headerColor, botColor, userColor, buttonColor });

  const archive = createZipArchive({ 'index.html': botPageHtml });
  const response = await deployToNetlify(archive);

  return {
    statusCode: 200,
    body: JSON.stringify({ url: response.deploy_ssl_url })
  };
};

function generateChatbotHtml({ title, systemPrompt, headerColor, botColor, userColor, buttonColor }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f4f4f4;
      touch-action: manipulation;
    }
    .chat-container {
      width: 90vw;
      max-width: 400px;
      height: 70vh;
      max-height: 500px;
      background: #fff;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
      position: fixed;
      bottom: 10px;
      right: 10px;
      display: flex;
      flex-direction: column;
      touch-action: none;
    }
    .chat-header {
      background: ${headerColor};
      color: white;
      padding: 10px;
      text-align: center;
      cursor: pointer;
    }
    .chat-box {
      height: calc(100% - 80px);
      overflow-y: scroll;
      padding: 10px;
      flex-grow: 1;
    }
    .chat-message {
      margin: 10px 0;
      padding: 10px;
      border-radius: 5px;
      background: #f1f1f1;
    }
    .chat-message.bot {
      background: ${botColor};
    }
    .chat-message.user {
      background: ${userColor};
      text-align: right;
    }
    .chat-input {
      display: flex;
      border-top: 1px solid #ddd;
      padding: 5px;
    }
    .chat-input input {
      flex: 1;
      padding: 10px;
      border: none;
      outline: none;
      font-size: 16px;
    }
    .chat-input button {
      padding: 10px;
      background: ${buttonColor};
      color: white;
      border: none;
      cursor: pointer;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">${title}</div>
    <div class="chat-box"></div>
    <div class="chat-input">
      <input type="text" placeholder="Type your message here..." onkeydown="checkEnter(event)">
      <button onclick="sendMessage()">Send</button>
    </div>
  </div>
  <script>
    const systemPrompt = ${JSON.stringify(systemPrompt)};

    function checkEnter(event) {
      if (event.key === 'Enter') {
        sendMessage();
      }
    }

    async function sendMessage() {
      const userInput = document.querySelector('.chat-input input').value;
      if (!userInput) return;

      addMessageToChatBox('user', userInput);
      document.querySelector('.chat-input input').value = '';

      const botMessageElement = addMessageToChatBox('bot', '');
      const response = await getGPT4Response(systemPrompt, userInput);
      streamFormattedText(botMessageElement, response);
    }

    function addMessageToChatBox(sender, message) {
      const chatBox = document.querySelector('.chat-box');
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message', sender);
      messageElement.innerHTML = marked.parse(message);
      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;
      MathJax.typesetPromise();
      return messageElement;
    }

    function streamFormattedText(element, text) {
      let index = 0;
      function type() {
        if (index < text.length) {
          element.innerHTML = marked.parse(text.substring(0, index + 1));
          index++;
          setTimeout(type, 30);
          MathJax.typesetPromise();
        }
      }
      type();
    }

    async function getGPT4Response(systemPrompt, userInput) {
      const response = await fetch('/.netlify/functions/getGPT4Response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ systemPrompt, userInput })
      });
      const data = await response.json();
      return data.choices[0].text.trim();
    }
  </script>
</body>
</html>`;
}

function createZipArchive(files) {
  const archive = archiver('zip');
  const bufferStream = new streamBuffers.WritableStreamBuffer();

  archive.pipe(bufferStream);
  Object.entries(files).forEach(([filename, content]) => {
    archive.append(content, { name: filename });
  });
  archive.finalize();

  return bufferStream.getContents();
}

async function deployToNetlify(archive) {
  const response = await fetch('https://api.netlify.com/api/v1/sites/YOUR_SITE_ID/deploys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'Authorization': `Bearer ${process.env.NETLIFY_ACCESS_TOKEN}`
    },
    body: archive
  });
  return response.json();
}
