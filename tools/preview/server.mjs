import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('../..', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 4173);
const clients = new Set();

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function sendFile(pathname, response) {
  const decoded = decodeURIComponent(pathname);
  const requested = normalize(join(root, decoded));
  const location = relative(root, requested);

  if (location.startsWith('..') || location.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  let file = requested;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
  });
  createReadStream(file).pipe(response);
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  if (url.pathname === '/') {
    response.writeHead(302, { Location: '/tools/preview/' }).end();
    return;
  }

  if (url.pathname === '/__preview_events') {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
    });
    response.write('event: connected\ndata: ready\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  sendFile(url.pathname, response);
});

const watchedRoots = ['src/templates', 'src/runtime', 'src/styles', 'tools/preview'];
for (const watchedRoot of watchedRoots) {
  const directory = join(root, watchedRoot);
  if (!existsSync(directory)) continue;

  watch(directory, { recursive: true }, (_event, filename) => {
    const payload = JSON.stringify({ path: `${watchedRoot}/${filename || ''}`.replaceAll('\\', '/') });
    for (const client of clients) client.write(`event: change\ndata: ${payload}\n\n`);
  });
}

server.listen(port, '127.0.0.1', () => {
  console.log(`Anki Prettify preview: http://127.0.0.1:${port}/tools/preview/`);
  console.log('Watching templates, styles, and preview files for changes.');
});
