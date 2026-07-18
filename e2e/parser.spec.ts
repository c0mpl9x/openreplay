import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const demoPath = resolve('vendor/demoparser/src/parser/test_demo.dem');

function mutatedPublicDemo(search: string, replacement: string, outputPath: string): string {
  const demo = readFileSync(demoPath);
  const searchBytes = Buffer.from(search, 'utf8');
  const offset = demo.indexOf(searchBytes);
  expect(offset).toBeGreaterThanOrEqual(0);
  expect(Buffer.byteLength(search)).toBe(Buffer.byteLength(replacement));
  demo.write(replacement, offset, 'utf8');
  writeFileSync(outputPath, demo);
  return outputPath;
}

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
    const mutatedDemoPath = mutatedPublicDemo(
      'de_mirage',
      'de_dust2\0',
      testInfo.outputPath('dust2.dem'),
    );

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(mutatedDemoPath);

    await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_MAP', { timeout: 90_000 });
    await expect(page.getByRole('alert')).toContainText('de_dust2');
  });

  test('rejects a truncated public demo as an invalid file', async ({ page }, testInfo) => {
    const demo = readFileSync(demoPath);
    const truncatedPath = testInfo.outputPath('truncated.dem');
    writeFileSync(truncatedPath, demo.subarray(0, 1024));

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(truncatedPath);

    await expect(page.getByRole('alert')).toContainText('INVALID_DEMO', { timeout: 90_000 });
    await expect(page.getByRole('alert')).toContainText(/corrupt|truncated|incomplete/iu);
  });

  test('rejects a public demo marked as a POV recording', async ({ page }, testInfo) => {
    const povPath = mutatedPublicDemo(
      'SourceTV Demo',
      'Player POV XX',
      testInfo.outputPath('pov.dem'),
    );

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(povPath);

    await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_DEMO_TYPE', {
      timeout: 90_000,
    });
    await expect(page.getByRole('alert')).toContainText('POV');
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
