const { Client } = require('@retracedhq/retraced');
require('dotenv').config();

const projectId = process.env.RETRACED_PROJECT_ID;
const apiKey = process.env.RETRACED_API_KEY;
const baseUrl = process.env.RETRACED_URL || 'http://localhost:3000';

console.log('--- Testing Retraced Client ---');
console.log('Base URL from env:', baseUrl);

async function testEndpoint(urlLabel, url) {
  console.log(`\nTesting with endpoint: ${urlLabel} -> ${url}`);
  const retraced = new Client({
    apiKey,
    projectId,
    endpoint: url,
  });

  const event = {
    action: 'test.client.event',
    group: { id: 'test-group', name: 'Test Group' },
    crud: 'c',
    actor: { id: 'test-actor', name: 'Test Actor' },
    created: new Date(),
  };

  try {
    await retraced.reportEvent(event);
    console.log('✅ Success!');
    return true;
  } catch (err) {
    console.log('❌ Failed:', err.message);
    if (err.response) {
      console.log('   Status:', err.response.status);
      console.log('   Data:', err.response.data);
    }
    return false;
  }
}

async function main() {
  // Test 1: Current Env Value
  await testEndpoint('Current Env', baseUrl);

  // Test 2: With /auditlog appended
  if (!baseUrl.endsWith('/auditlog')) {
    await testEndpoint('With /auditlog', `${baseUrl}/auditlog`);
  }
}

main();
