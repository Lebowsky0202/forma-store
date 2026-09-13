import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { frontendRouter } from '../src/frontend.js';

let directory: string;
const app = express();
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'forma-frontend-'));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><title>FORMA test</title>');
  await writeFile(path.join(directory, 'assets', 'app.js'), 'window.forma = true;');
  app.use(frontendRouter(directory));
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND' } }); });
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

test('compiled frontend serves SPA deep links and real static assets', async () => {
  await request(app).get('/catalog/zhenshchinam').set('Accept', 'text/html').expect(200).expect('Cache-Control', 'no-cache').expect(/FORMA test/);
  await request(app).get('/assets/app.js').expect(200).expect(/window.forma/);
});

test('SPA fallback preserves missing API, uploads, assets and non-HTML errors', async () => {
  for (const route of ['/api', '/api/unknown', '/uploads/missing', '/assets/missing.js', '/.env', '/missing.css']) {
    const response = await request(app).get(route).set('Accept', 'text/html').expect(404);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  }
  await request(app).get('/catalog').set('Accept', 'application/json').expect(404);
  await request(app).post('/catalog').expect(404);
});

test('misconfigured frontend root fails before accepting traffic', () => {
  assert.throws(() => frontendRouter(path.join(directory, 'absent')), /built index.html/);
});
