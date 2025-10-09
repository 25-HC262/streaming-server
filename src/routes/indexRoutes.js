import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const indexRoutes = (app) => {
    app.get('/', (req, res) => {
        res.sendFile('./src/index.html', { root: process.cwd() });
    });
};