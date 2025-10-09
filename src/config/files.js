import fs from 'fs';
import { join } from 'path';

export const getFilePath = (url) => {
    return join(process.cwd(), 'src', url.replace('/src', ''));
};

export const checkFileExists = (filePath) => {
    return new Promise((resolve) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            resolve(!err);
        });
    });
};

export const createFileStream = (filePath) => {
    return fs.createReadStream(filePath);
};