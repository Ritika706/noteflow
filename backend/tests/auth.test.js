// Automated tests for authentication routes
const request = require('supertest');
const app = require('../src/server.js');

describe('Auth API', () => {
  it('should return 400 for missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBeDefined();
  });
  // Add more auth tests as needed
});
