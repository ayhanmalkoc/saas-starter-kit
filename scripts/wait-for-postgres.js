const { execSync } = require('child_process');

const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS || 120000);
const intervalMs = Number(process.env.DB_WAIT_INTERVAL_MS || 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const commandExists = (command) => {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const resolveComposeCommand = () => {
  if (commandExists('docker-compose version')) {
    return 'docker-compose';
  }

  if (commandExists('docker compose version')) {
    return 'docker compose';
  }

  throw new Error(
    'Neither "docker-compose" nor "docker compose" is available in PATH.'
  );
};

async function main() {
  const composeCommand = resolveComposeCommand();
  const readinessCommand = `${composeCommand} exec -T db pg_isready -U postgres -d saas-starter-kit`;
  const startedAt = Date.now();

  console.log(
    `Waiting for PostgreSQL readiness (timeout=${timeoutMs}ms, interval=${intervalMs}ms)...`
  );

  while (Date.now() - startedAt < timeoutMs) {
    if (commandExists(readinessCommand)) {
      console.log('PostgreSQL is ready.');
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `PostgreSQL did not become ready within ${timeoutMs}ms. Check "docker-compose logs db".`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
