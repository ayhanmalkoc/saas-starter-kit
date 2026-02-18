const { Client } = require('@retracedhq/retraced');
require('dotenv').config();

const projectId = process.env.RETRACED_PROJECT_ID;
const apiKey = process.env.RETRACED_API_KEY;
const endpoint = process.env.RETRACED_URL; // http://localhost:3000/auditlog

console.log('--- Testing Retraced Viewer Token ---');
console.log('Endpoint:', endpoint);
console.log('Project:', projectId);

async function main() {
  const retraced = new Client({
    apiKey,
    projectId,
    endpoint,
  });

  try {
    const token = await retraced.getViewerToken(
      'test-group',
      'test-actor',
      true
    );
    console.log('✅ Viewer Token received:', token);
  } catch (err) {
    console.error('❌ Failed to get viewer token:');
    console.error('Message:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

main();
