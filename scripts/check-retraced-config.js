require('dotenv').config();
const { Client } = require('pg');

const maskToken = (value) => {
  if (!value) {
    return '(missing)';
  }

  if (value.length <= 4) {
    return '****';
  }

  return `****${value.slice(-4)}`;
};

async function main() {
  const connectionString = process.env.RETRACED_DATABASE_URL;
  const projectId = process.env.RETRACED_PROJECT_ID;
  const apiKey = process.env.RETRACED_API_KEY;

  if (!connectionString) {
    console.error(
      'RETRACED_DATABASE_URL is required. Example: postgresql://postgres:postgres@localhost:5432/retraced'
    );
    process.exit(1);
  }

  if (!projectId || !apiKey) {
    console.error(
      `Missing required Retraced env vars. projectId=${Boolean(projectId)} apiKey=${Boolean(apiKey)}`
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  await client.connect();

  console.log('--- Configuration Check ---');
  console.log(`ENV Project ID: ${projectId}`);
  console.log(`ENV API Key:    ${maskToken(apiKey)}`);

  const projectRes = await client.query('SELECT * FROM project WHERE id = $1', [
    projectId,
  ]);

  let hasError = false;

  if (projectRes.rows.length > 0) {
    console.log('✅ Project found in DB.');
  } else {
    console.error('❌ Project NOT found in DB!');
    hasError = true;
  }

  const tokenRes = await client.query('SELECT * FROM token WHERE token = $1', [
    apiKey,
  ]);

  if (tokenRes.rows.length > 0) {
    console.log('✅ Token found in DB.');
  } else {
    console.error('❌ Token NOT found in DB!');
    hasError = true;
  }

  await client.end();

  if (hasError) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Retraced config check failed:', error);
  process.exit(1);
});
