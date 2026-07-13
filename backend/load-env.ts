import dotenv from 'dotenv';
import path from 'path';

const backendEnv = path.resolve(process.cwd(), '.env');
const projectEnv = path.resolve(process.cwd(), '..', '.env');

// `npm run backend` runs from backend/, while production can run from the
// project root. Prefer backend configuration and fall back to the shared file.
dotenv.config({ path: backendEnv });
dotenv.config({ path: projectEnv, override: false });
