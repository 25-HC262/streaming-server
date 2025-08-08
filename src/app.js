import express from 'express';
import fs from 'fs';
import hls from 'hls-server';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Serve static files from the src directory
app.use('/src', express.static(join(process.cwd(), 'src')));

app.get('/', (req, res) => {
    res.sendFile('./src/client.html', { root: process.cwd() });
});

const server = app.listen(3000);

// HLS server configuration
new hls(server, {
    provider: {
        exists: (req, cb) => {
            const ext = req.url.split('.').pop();
            if (ext !== 'm3u8' && ext !== 'ts') {
                return cb(null, true);
            }

            const filePath = join(process.cwd(), 'src', req.url.replace('/src', ''));
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    console.log('File not exist:', filePath);
                    return cb(null, false);
                }
                cb(null, true);
            });
        },
        getManifestStream: (req, cb) => {
            const filePath = join(process.cwd(), 'src', req.url.replace('/src', ''));
            const stream = fs.createReadStream(filePath);
            cb(null, stream);
        },
        getSegmentStream: (req, cb) => {
            const filePath = join(process.cwd(), 'src', req.url.replace('/src', ''));
            const stream = fs.createReadStream(filePath);
            cb(null, stream);
        }
    }
});

export default app;