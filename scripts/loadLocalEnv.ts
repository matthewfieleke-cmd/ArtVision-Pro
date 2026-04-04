import { config } from 'dotenv';

// Match the local dev API bootstrap: prefer .env.local, then fall back to .env.
config({ path: '.env.local' });
config({ path: '.env' });
