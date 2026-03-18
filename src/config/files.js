import fs from 'fs';
import { join } from 'path';

// URL 경로를 기준으로 프로젝트의 `src/` 아래 파일 경로를 계산합니다.
export const getFilePath = (url) => {
  return join(process.cwd(), 'src', url.replace('/src', ''));
};

// 파일 존재 여부를 Promise로 비동기 확인합니다.
export const checkFileExists = (filePath) => {
  return new Promise((resolve) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      resolve(!err);
    });
  });
};

// 파일을 읽기 위한 ReadStream을 생성합니다.
export const createFileStream = (filePath) => {
  return fs.createReadStream(filePath);
};

