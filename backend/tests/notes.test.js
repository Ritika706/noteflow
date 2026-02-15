// Automated tests for notes routes
const request = require('supertest');
const app = require('../src/server.js');

describe('Notes API', () => {
  it('should require authentication for protected routes', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'Test Note' });
    expect(res.statusCode).toBe(401);
  });
  // Add more notes tests as needed
});
