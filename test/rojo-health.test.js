const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { checkRojoHealth } = require('../lib/rojo');

function withServer(handler, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      try {
        await fn(server.address().port);
        server.close(() => resolve());
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('checkRojoHealth reports healthy for a valid Rojo API response', async () => {
  await withServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: 'MyGame' }));
    },
    async (port) => {
      const result = await checkRojoHealth(port);
      assert.deepEqual(result, { healthy: true, projectName: 'MyGame' });
    }
  );
});

test('checkRojoHealth reports unhealthy for a non-JSON response', async () => {
  await withServer(
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('not json');
    },
    async (port) => {
      const result = await checkRojoHealth(port);
      assert.deepEqual(result, { healthy: false });
    }
  );
});

test('checkRojoHealth reports unhealthy when nothing is listening on the port', async () => {
  const result = await checkRojoHealth(65530);
  assert.deepEqual(result, { healthy: false });
});
