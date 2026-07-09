const path = require('path');
const { fileURLToPath } = require('url');

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
];

function buildContentSecurityPolicy() {
  return CSP_DIRECTIVES.join('; ');
}

function setHeader(headers, headerName, value) {
  const next = { ...(headers || {}) };
  Object.keys(next).forEach((key) => {
    if (key.toLowerCase() === headerName.toLowerCase()) {
      delete next[key];
    }
  });
  next[headerName] = [value];
  return next;
}

function buildSecurityHeaders(responseHeaders) {
  let headers = setHeader(responseHeaders, 'Content-Security-Policy', buildContentSecurityPolicy());
  headers = setHeader(headers, 'X-Content-Type-Options', 'nosniff');
  return headers;
}

function parseUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch (err) {
    return null;
  }
}

function isExternalHttpUrl(rawUrl) {
  const parsed = parseUrl(rawUrl);
  return Boolean(parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:'));
}

function isInsideDirectory(filePath, directoryPath) {
  const relative = path.relative(path.resolve(directoryPath), path.resolve(filePath));
  return relative === '' || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function shouldAllowNavigation(rawUrl, appRoot) {
  if (rawUrl === 'about:blank') return true;
  const parsed = parseUrl(rawUrl);
  if (!parsed || parsed.protocol !== 'file:' || !appRoot) return false;

  try {
    return isInsideDirectory(fileURLToPath(parsed), appRoot);
  } catch (err) {
    return false;
  }
}

module.exports = {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  isExternalHttpUrl,
  shouldAllowNavigation,
};
