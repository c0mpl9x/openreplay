import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const demoPath = resolve('vendor/demoparser/src/parser/test_demo.dem');
const privateDemoPath = process.env.OPENREPLAY_PRIVATE_DEMO
  ? resolve(process.env.OPENREPLAY_PRIVATE_DEMO)
  : undefined;
const mapFixtureDirectory = process.env.OPENREPLAY_MAP_FIXTURES
  ? resolve(process.env.OPENREPLAY_MAP_FIXTURES)
  : undefined;
const MAX_LOCAL_DEMO_BYTES = 500 * 1024 * 1024;
const ACTIVE_DUTY_FIXTURES = [
  { mapName: 'de_ancient', displayName: 'Ancient' },
  { mapName: 'de_anubis', displayName: 'Anubis' },
  { mapName: 'de_cache', displayName: 'Cache' },
  { mapName: 'de_dust2', displayName: 'Dust II' },
  { mapName: 'de_inferno', displayName: 'Inferno' },
  { mapName: 'de_mirage', displayName: 'Mirage' },
  { mapName: 'de_nuke', displayName: 'Nuke' },
] as const;

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

  test('parses the pinned public Mirage fixture entirely on localhost', async ({
    page,
  }, testInfo) => {
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

    await page.getByRole('button', { name: 'New demo' }).click();
    const secondDemoPath = testInfo.outputPath('second-mirage.dem');
    copyFileSync(demoPath, secondDemoPath);
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(secondDemoPath);
    await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText('second-mirage.dem')).toBeVisible();
  });

  test('parses an optional local private acceptance demo', async ({ page }) => {
    if (privateDemoPath === undefined) {
      test.skip(true, 'Set OPENREPLAY_PRIVATE_DEMO to run the local-only acceptance check.');
      return;
    }

    const { size } = statSync(privateDemoPath);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(MAX_LOCAL_DEMO_BYTES);
    const fileName = basename(privateDemoPath);
    const externalRequests: string[] = [];
    const writes: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') externalRequests.push(request.url());
      if (!['GET', 'HEAD'].includes(request.method()))
        writes.push(`${request.method()} ${request.url()}`);
    });
    const parsePrivateDemo = async (): Promise<number> => {
      const startedAt = Date.now();
      await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(privateDemoPath);

      await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByText(fileName)).toBeVisible();
      return Date.now() - startedAt;
    };

    await page.goto('./');
    const firstDuration = await parsePrivateDemo();
    await page.getByRole('button', { name: 'New demo' }).click();
    const secondDuration = await parsePrivateDemo();
    expect(externalRequests).toEqual([]);
    expect(writes).toEqual([]);
    console.log(
      `[private acceptance] ${fileName}: first ${firstDuration} ms, second ${secondDuration} ms, ${size} bytes`,
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Drop your .dem file here' })).toBeVisible();
  });

  for (const { mapName, displayName } of ACTIVE_DUTY_FIXTURES) {
    test(`parses an optional ${displayName} Active Duty fixture`, async ({ page }) => {
      const fixturePath =
        mapFixtureDirectory === undefined
          ? undefined
          : resolve(mapFixtureDirectory, `${mapName}.dem`);
      if (fixturePath === undefined || !existsSync(fixturePath)) {
        test.skip(true, 'Set OPENREPLAY_MAP_FIXTURES to a directory containing map demos.');
        return;
      }

      const { size } = statSync(fixturePath);
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(MAX_LOCAL_DEMO_BYTES);

      await page.goto('./');
      await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(fixturePath);
      await expect(page.getByRole('img', { name: `${displayName} replay radar` })).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByText(`${displayName}`, { exact: true })).toBeVisible();
    });
  }

  test('rejects a Source 2 map outside the Active Duty pool', async ({ page }, testInfo) => {
    const mutatedDemoPath = mutatedPublicDemo(
      'de_mirage',
      'de_train\0',
      testInfo.outputPath('train.dem'),
    );

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(mutatedDemoPath);

    await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_MAP', { timeout: 90_000 });
    await expect(page.getByRole('alert')).toContainText('de_train');
  });

  test('rejects a truncated public demo as an invalid file', async ({ page }, testInfo) => {
    const demo = readFileSync(demoPath);
    const truncatedPath = testInfo.outputPath('truncated.dem');
    writeFileSync(truncatedPath, demo.subarray(0, 1024));

    await page.goto('./');
    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(truncatedPath);

    await expect(page.getByRole('alert')).toContainText('INVALID_DEMO', { timeout: 90_000 });
    await expect(page.getByRole('alert')).toContainText(/corrupt|truncated|incomplete/iu);

    await page.getByRole('button', { name: 'Open another demo' }).click();
    await page.getByRole('button', { name: 'Preview sample replay' }).click();
    await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible();
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

    await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles(demoPath);
    await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible({
      timeout: 90_000,
    });
  });
});
