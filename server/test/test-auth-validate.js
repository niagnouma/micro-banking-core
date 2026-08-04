import http from 'k6/http';
import { sleep, check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_USERNAME = __ENV.ADMIN_USERNAME || 'Dioman';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Mouhammad';

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const loginRes = http.post(
    `${BASE_URL}/api/v1/admin/login`,
    JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status === 200) {
    const token = loginRes.json('data.accessToken');
    const statusRes = http.get(`${BASE_URL}/api/v1/admin/status`, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
    });

    check(statusRes, {
      'validation du token réussie': (r) => r.status === 200,
    });
  }

  sleep(1);
}
