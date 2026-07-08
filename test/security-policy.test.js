const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  isExternalHttpUrl,
  shouldAllowNavigation,
} = require('../lib/security-policy');

test('buildContentSecurityPolicy includes restrictive renderer defaults', () => {
  const csp = buildContentSecurityPolicy();
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'none'/);
});

test('buildSecurityHeaders replaces existing security headers case-insensitively', () => {
  const result = buildSecurityHeaders({
    'content-security-policy': ["default-src *"],
    'X-Content-Type-Options': ['old'],
    'Cache-Control': ['no-cache'],
  });

  assert.equal(result['content-security-policy'], undefined);
  assert.equal(result['Content-Security-Policy'][0], buildContentSecurityPolicy());
  assert.deepEqual(result['X-Content-Type-Options'], ['nosniff']);
  assert.deepEqual(result['Cache-Control'], ['no-cache']);
});

test('shouldAllowNavigation only allows files under the app root', () => {
  const appRoot = path.join(os.tmpdir(), 'baseplate-app-root');
  const allowedUrl = pathToFileURL(path.join(appRoot, 'renderer', 'index.html')).href;
  const blockedFileUrl = pathToFileURL(path.join(os.tmpdir(), 'outside-baseplate', 'index.html')).href;

  assert.equal(shouldAllowNavigation(allowedUrl, appRoot), true);
  assert.equal(shouldAllowNavigation('about:blank', appRoot), true);
  assert.equal(shouldAllowNavigation(blockedFileUrl, appRoot), false);
  assert.equal(shouldAllowNavigation('https://create.roblox.com', appRoot), false);
  assert.equal(shouldAllowNavigation('javascript:alert(1)', appRoot), false);
  assert.equal(shouldAllowNavigation('not a url', appRoot), false);
});

test('isExternalHttpUrl identifies browser-safe external URLs', () => {
  assert.equal(isExternalHttpUrl('https://create.roblox.com'), true);
  assert.equal(isExternalHttpUrl('http://localhost:34872'), true);
  assert.equal(isExternalHttpUrl('file:///C:/Projects/baseplate/index.html'), false);
  assert.equal(isExternalHttpUrl('javascript:alert(1)'), false);
  assert.equal(isExternalHttpUrl('not a url'), false);
});
