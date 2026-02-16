require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/retraced',
});

async function main() {
  await client.connect();

  const projectId = process.env.RETRACED_PROJECT_ID;
  const apiKey = process.env.RETRACED_API_KEY;

  console.log('--- Configuration Check ---');
  console.log(`ENV Project ID: ${projectId}`);
  console.log(`ENV API Key:    ${apiKey}`);

  const projectRes = await client.query('SELECT * FROM project WHERE id = $1', [
    projectId,
  ]);
  if (projectRes.rows.length > 0) {
    console.log('✅ Project found in DB.');
  } else {
    console.error('❌ Project NOT found in DB!');
  }

  const tokenRes = await client.query('SELECT * FROM token WHERE token = $1', [
    apiKey,
  ]);
  if (tokenRes.rows.length > 0) {
    console.log('✅ Token found in DB.');
  } else {
    console.error('❌ Token NOT found in DB!');
  }

  await client.end();
}

main().catch(console.error);
