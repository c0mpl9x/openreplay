import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const demoPath = resolve('vendor/demoparser/src/parser/test_demo.dem');

test.describe('real demoparser2 integration', () => {
  test.setTimeout(120_000);

  test('parses the pinned public Mirage fixture entirely on localhost', async ({ page }) => {
    const externalRequests: string[] = [];
    const writes: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') externalRequests.push(request.url());
      if (!['GET', 'HEAD'].includes(request.method()))
        writes.push(`${request.method()} ${request.url()}`);
    });

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(demoPath);

    await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText('test_demo.dem')).toBeVisible();
    await expect(page.getByText('Players').locator('..')).toContainText('10', {
      timeout: 90_000,
    });
    await expect(page.getByText('Rounds').locator('..')).toContainText('10', {
      timeout: 90_000,
    });
    expect(externalRequests).toEqual([]);
    expect(writes).toEqual([]);
  });

  test('rejects a non-Mirage Source 2 header with a public error', async ({ page }, testInfo) => {
    const demo = readFileSync(demoPath);
    const mapOffset = demo.indexOf(Buffer.from('de_mirage'));
    expect(mapOffset).toBeGreaterThan(0);
    demo.write('de_dust2\0', mapOffset, 'utf8');
    const mutatedDemoPath = testInfo.outputPath('dust2.dem');
    writeFileSync(mutatedDemoPath, demo);

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(mutatedDemoPath);

    await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_MAP', { timeout: 90_000 });
    await expect(page.getByRole('alert')).toContainText('de_dust2');
  });

  test('can cancel and immediately release an active parse', async ({ page }) => {
    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(demoPath);
    const cancel = page.getByRole('button', { name: 'Cancel' });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(page.getByRole('heading', { name: 'Drop your .dem file here' })).toBeVisible();
  });
});
