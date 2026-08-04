import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const successDuration = new Trend('success_duration');
const rateLimitedDuration = new Trend('rate_limited_duration');

export const options = {
    stages: [
        { duration: '5s', target: 5 },
        { duration: '5s', target: 200 },
        { duration: '10s', target: 200 },
        { duration: '5s', target: 5 },
        { duration: '5s', target: 0 },
    ],
};

export default function () {
    const res = http.get('http://localhost:3000/internal/health');

    if (res.status === 200) {
        successDuration.add(res.timings.duration);
    } else if (res.status === 429) {
        rateLimitedDuration.add(res.timings.duration);
    }

    check(res, {
        'statut est 200 ou 429': (r) => r.status === 200 || r.status === 429,
    });

    sleep(0.5);
}