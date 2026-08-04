import http from 'k6/http';

export function ensureAdmin(baseUrl, username, password) {
  const setupRes = http.post(
    `${baseUrl}/api/v1/admin/setup`,
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  return setupRes;
}
