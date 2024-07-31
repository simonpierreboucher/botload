const fetch = require('node-fetch');
const archiver = require('archiver');
const streamBuffers = require('stream-buffers');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://<your-database-name>.firebaseio.com'
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  const { title, systemPrompt, headerColor, botColor, userColor, buttonColor } = JSON.parse(event.body);

  const templatePath = path.resolve(__dirname, '../../src/chatbotTemplate.html');
  let botPageHtml = fs.readFileSync(templatePath, 'utf8');

  botPageHtml = botPageHtml
    .replace(/{{title}}/g, title)
    .replace(/{{systemPrompt}}/g, systemPrompt)
    .replace(/{{headerColor}}/g, headerColor)
    .replace(/{{botColor}}/g, botColor)
    .replace(/{{userColor}}/g, userColor)
    .replace(/{{buttonColor}}/g, buttonColor);

  const archive = createZipArchive({ 'index.html': botPageHtml });
  const response = await deployToNetlify(archive);

  const url = response.deploy_ssl_url;

  // Save URL to Firestore
  await db.collection('chatbots').add({
    title,
    systemPrompt,
    headerColor,
    botColor,
    userColor,
    buttonColor,
    url,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url })
  };
};

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
