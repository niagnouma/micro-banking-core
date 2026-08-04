import http from 'k6/http';
import { sleep, check } from 'k6';
import { ensureAdmin } from '../helpers/k6-setup.js';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_USERNAME = __ENV.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'azerty6784';

export const options = {
  scenarios: {
    auth_and_business_flow: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      stages: [
        { target: 8, duration: '20s' },
        { target: 12, duration: '20s' },
        { target: 16, duration: '20s' },
      ],
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.95'],
  },
};

function buildHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-auth-token': token } : {}),
    },
  };
}

export default function () {
  const setupStatusRes = http.get(`${BASE_URL}/api/v1/admin/setup-status`);
  check(setupStatusRes, {
    'statut de setup traité': (r) => r.status === 200 || r.status === 500,
    'la réponse setup est en JSON': (r) => r.headers['Content-Type']?.includes('application/json') || false,
  });

  if (setupStatusRes.status === 200) {
    const setupBody = setupStatusRes.json('data') || {};
    if (!setupBody.isInitialized) {
      ensureAdmin(BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD);
    }
  }

  const loginRes = http.post(
    `${BASE_URL}/api/v1/admin/login`,
    JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    buildHeaders(),
  );

  check(loginRes, {
    'login réussi': (r) => r.status === 200,
  });

  if (loginRes.status !== 200) {
    sleep(0.2);
    return;
  }

  const token = loginRes.json('data.accessToken');
  const statusRes = http.get(`${BASE_URL}/api/v1/admin/status`, buildHeaders(token));
  check(statusRes, {
    'token valide': (r) => r.status === 200,
  });

  const uniqueSuffix = `${Date.now()}-${__ITER}-${Math.floor(Math.random() * 100000)}`;

  const agentRes = http.post(
    `${BASE_URL}/api/v1/agents`,
    JSON.stringify({
      firstname: `Stress${__ITER}`,
      lastname: `Agent${__ITER}`,
      email: `stress${uniqueSuffix}@example.com`,
      phone: `+22177${Math.floor(Math.random() * 10000000)}`,
      location: 'Dakar',
    }),
    buildHeaders(token),
  );

  const agentCreationOk = agentRes.status === 200 || agentRes.status === 201;
  check(agentRes, {
    'agent créé': (r) => agentCreationOk,
  });

  const clientRes = http.post(
    `${BASE_URL}/api/v1/clients`,
    JSON.stringify({
      firstname: `Client${__ITER}`,
      lastname: `Load${__ITER}`,
      email: `client${uniqueSuffix}@example.com`,
      phone: `+22178${Math.floor(Math.random() * 10000000)}`,
      location: 'Bamako',
      agentId: 1,
      montantEngagement: 10000,
    }),
    buildHeaders(token),
  );

  const clientCreationOk = clientRes.status === 200 || clientRes.status === 201;
  check(clientRes, {
    'client créé': (r) => clientCreationOk,
  });

  sleep(1.5);
}
