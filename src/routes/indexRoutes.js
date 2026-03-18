import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express 라우팅을 등록해 루트(`/`) 요청을 처리합니다.
export const indexRoutes = (app) => {
  // 루트 페이지의 정적 HTML을 반환합니다.
  function onRoot(req, res) {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
  }

  app.get('/', onRoot);
};

