import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 500,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const clientId = `client-${Math.floor(Math.random() * 100)}`;
  const response = http.get(`${baseUrl}/api/test`, {
    headers: { 'X-API-Key': clientId },
  });
  check(response, {
    'status is 200 or 429': (res) => res.status === 200 || res.status === 429,
    'rate limit header present': (res) => res.headers['X-Ratelimit-Limit'] !== undefined,
  });
}
