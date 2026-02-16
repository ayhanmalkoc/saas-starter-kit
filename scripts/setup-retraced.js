const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

function updateEnv(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  const regex = new RegExp(`^${key}=.*`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`Updated ${key} in .env`);
}

function runSql(sql) {
  const command = `docker exec -i saas-starter-kit-db-1 psql -U postgres -d retraced`;
  try {
    execSync(command, { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
  } catch (error) {
    console.error('Failed to run SQL:', sql);
    console.error(error.message);
    process.exit(1);
  }
}

function main() {
  console.log('Setting up Retraced via direct DB insertion...');

  const projectId = crypto.randomUUID();
  const envId = crypto.randomUUID();
  // Token usually starts with 'dev-' or similar, Retraced handles generic strings
  const apiToken = 'retraced_dev_' + crypto.randomBytes(16).toString('hex');
  const projectName = 'saas-starter-kit-dev';

  console.log(`Project ID: ${projectId}`);
  console.log(`Environment ID: ${envId}`);
  console.log(`API Token: ${apiToken}`);

  // Insert Project
  console.log('Inserting Project...');
  runSql(
    `INSERT INTO project (id, name, created) VALUES ('${projectId}', '${projectName}', NOW());`
  );

  // Insert Environment
  console.log('Inserting Environment...');
  runSql(
    `INSERT INTO environment (id, name, project_id) VALUES ('${envId}', 'dev', '${projectId}');`
  );

  // Insert Token
  console.log('Inserting Token...');
  runSql(
    `INSERT INTO token (token, created, project_id, environment_id, name, disabled) VALUES ('${apiToken}', NOW(), '${projectId}', '${envId}', 'dev-token', false);`
  );

  console.log('Database updated successfully.');

  updateEnv('RETRACED_PROJECT_ID', projectId);
  updateEnv('RETRACED_API_KEY', apiToken);

  // Ensure URL is correct in .env (optional, but good practice)
  // updateEnv('RETRACED_URL', 'http://localhost:3000');

  console.log('Done.');
}

main();
