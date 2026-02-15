// Start the server (for production/dev, not for tests)
const app = require('./server');
const { connectDb } = require('./db');

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment');
  }

  await connectDb();
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.log(`✅ API listening on ${port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});