import { expect, test } from '@playwright/test';

test('opens the local sample and exercises replay controls', async ({ page }) => {
  await page.goto('./');

  await expect(
    page.getByText('Processed locally — your demo never leaves this device'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Preview sample replay' }).click();

  await expect(page.getByText('synthetic-de-mirage.dem')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible();
  await expect(page.getByText('Players').locator('..')).toContainText('10');
  await expect(page.getByText('Rounds').locator('..')).toContainText('2');

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByLabel('Kill feed')).toBeVisible();
  await expect(page.locator('.match-info')).toBeVisible();
  const radarBounds = await page.getByRole('img', { name: 'Mirage replay radar' }).boundingBox();
  expect(radarBounds).not.toBeNull();
  expect(Math.abs((radarBounds?.width ?? 0) - (radarBounds?.height ?? 0))).toBeLessThanOrEqual(1);

  const timeline = page.getByLabel('Replay timeline');
  await timeline.fill('43');
  await expect(page.getByLabel('Kill feed')).toContainText('Player 6');
  await expect(page.getByLabel('Kill feed')).toContainText('Player 1');
  await expect(page.locator('.timeline-marker--bomb_planted')).toHaveCount(1);
  await timeline.fill('57');
  await expect(page.getByText('Bomb planted · A')).toBeVisible();
  await timeline.fill('89');
  await expect(page.getByText('Bomb defused · A')).toBeVisible();

  await page.getByLabel('Playback speed').selectOption('4');
  await expect(page.getByLabel('Playback speed')).toHaveValue('4');
  await page.getByLabel('Playback speed').selectOption('0.5');
  await timeline.fill('16');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByLabel('Pause')).toBeVisible();
  await page.getByLabel('Pause').click();

  await page.getByLabel('Next round').click();
  await expect(page.getByText('ROUND 2', { exact: true })).toBeVisible();
  await expect(page.locator('.timeline-marker--bomb_exploded')).toHaveCount(1);
  await page.getByLabel('Previous round').click();
  await expect(page.getByText('ROUND 1', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New demo' }).first().click();
  await expect(page.getByRole('heading', { name: 'Drop your .dem file here' })).toBeVisible();
});

test('clears the replay when the page is reloaded', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Preview sample replay' }).click();
  await expect(page.getByText('synthetic-de-mirage.dem')).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const browserGlobal = globalThis as unknown as {
          readonly localStorage: { readonly length: number };
          readonly sessionStorage: { readonly length: number };
        };
        return {
          localStorage: browserGlobal.localStorage.length,
          sessionStorage: browserGlobal.sessionStorage.length,
        };
      }),
    )
    .toEqual({ localStorage: 0, sessionStorage: 0 });

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Drop your .dem file here' })).toBeVisible();
  await expect(page.getByText('synthetic-de-mirage.dem')).not.toBeVisible();
});

test('rejects an invalid local file without uploading it', async ({ page }) => {
  const nonLocalRequests: string[] = [];
  const writes: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') nonLocalRequests.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method()))
      writes.push(`${request.method()} ${request.url()}`);
  });

  await page.goto('./');
  await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles({
    name: 'broken.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a Source 2 demo'),
  });

  await expect(page.getByRole('alert')).toContainText('INVALID_DEMO');
  expect(nonLocalRequests).toEqual([]);
  expect(writes).toEqual([]);

  await page.getByRole('button', { name: 'Open another demo' }).click();
  await page.getByRole('button', { name: 'Preview sample replay' }).click();
  await expect(page.getByRole('img', { name: 'Mirage replay radar' })).toBeVisible();
});

test('rejects a Source 1 demo before starting the parser worker', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Choose a CS2 GOTV demo').setInputFiles({
    name: 'legacy-source1.dem',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('HL2DEMO\0'),
  });

  await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_DEMO_TYPE');
  await expect(page.getByRole('alert')).toContainText('Source 1');
});
