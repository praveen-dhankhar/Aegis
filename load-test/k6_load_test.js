import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

const status200 = new Counter('status_200');
const status429 = new Counter('status_429');
const statusOther = new Counter('status_other');

export const options = {
  vus: 500,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080';
const clientPrefix = __ENV.CLIENT_PREFIX || 'client';
const clientPool = Number.parseInt(__ENV.CLIENT_POOL || '100', 10);

export default function () {
  const clientId = `${clientPrefix}-${Math.floor(Math.random() * clientPool)}`;
  const response = http.get(`${baseUrl}/api/test`, {
    headers: { 'X-API-Key': clientId },
  });
  if (response.status === 200) {
    status200.add(1);
  } else if (response.status === 429) {
    status429.add(1);
  } else {
    statusOther.add(1);
  }
  check(response, {
    'status is 200 or 429': (res) => res.status === 200 || res.status === 429,
    'rate limit header present': (res) => res.headers['X-Ratelimit-Limit'] !== undefined,
  });
}
