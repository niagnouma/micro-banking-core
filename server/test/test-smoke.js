import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 2,
    duration: '10s',
};

export default function () {
    const res = http.get('http://localhost:3000/internal/health');

    check(res, {
        'statut est 200': (r) => r.status === 200,
        'renvoie ok': (r) => r.json('status') === 'ok',
    });

    sleep(1);
}