import env from '../env';

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

if (env.jackson.apiKey) {
  headers.Authorization = `Bearer ${env.jackson.apiKey}`;
}

export const options = {
  headers,
};
