import { expect, test } from '@playwright/test';

const API_ORIGIN = 'http://127.0.0.1:8080';

test.describe('Aegis Gözcü E2E Doğrulaması', () => {
  test('1. Uygulama API bağlantısı yokken dürüst boş durumlarda açılır', async ({ page }) => {
    await page.route(`${API_ORIGIN}/**`, (route) => route.abort());
    await page.goto('/');

    await expect(page.getByText('Bağlantı bekleniyor').first()).toBeVisible();
    await expect(page.getByText('Eşleşmiş cihaz yok').first()).toBeVisible();
    await expect(page.getByText('Gerçek olay kaydı yok').first()).toBeVisible();
    await expect(page.getByText('Veri yok').first()).toBeVisible();
    await expect(page.getByText('Aktif paylaşım yok').first()).toBeVisible();

    // Sahte demo cihaz isimleri görünmemeli
    await expect(page.getByText('win11-workstation')).toHaveCount(0);
    await expect(page.getByText('macbook-pro-m3')).toHaveCount(0);
  });

  test('2. Gerçek API bağlantısı kurulduğunda cihaz ve olay etiketleri gösterilir', async ({ page }) => {
    await page.route(`${API_ORIGIN}/healthz`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
    );
    await page.route(`${API_ORIGIN}/readyz`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready' }) })
    );
    await page.route(`${API_ORIGIN}/v1/devices`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'real',
          devices: [
            { device_id: 'enc_dev_e2e_1', hostname: 'ofis-is-istasyonu', platform: 'windows', status: 'active' },
          ],
        }),
      })
    );
    await page.route(`${API_ORIGIN}/v1/events`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'real',
          events: [
            {
              event_id: '019339a2-7b40-7f12-9a10-8e4c1b204108',
              device_id: 'enc_dev_e2e_1',
              timestamp: '2026-11-19T10:00:00Z',
              title: 'WFP Çıkış Kuralı Doğrulandı',
              description: 'Doğrulanmış olay kaydı.',
              severity: 'high',
              status: 'new',
            },
          ],
        }),
      })
    );
    await page.route(`${API_ORIGIN}/v1/shares`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'real', shares: [] }),
      })
    );

    await page.goto('/');

    await expect(page.getByText('Gerçek veri bağlantısı').first()).toBeVisible();
    await expect(page.getByText('Hazır').first()).toBeVisible();
    await expect(page.getByText('Gerçek cihazlar').first()).toBeVisible();
    await expect(page.getByText('Gerçek olay kayıtları').first()).toBeVisible();
  });

  test('3. Komut onayı: Vazgeç sırasında POST yapılmaz, onayda explicit_user_confirmation: true gönderilir ve 428 işlenir', async ({ page }) => {
    let commandPosts = 0;
    let lastCommandBody: Record<string, unknown> | null = null;
    let force428 = false;

    await page.route(`${API_ORIGIN}/healthz`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
    );
    await page.route(`${API_ORIGIN}/readyz`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready' }) })
    );
    await page.route(`${API_ORIGIN}/v1/devices`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'real',
          devices: [
            { device_id: 'enc_dev_e2e_1', hostname: 'ofis-is-istasyonu', platform: 'windows', status: 'active' },
          ],
        }),
      })
    );
    await page.route(`${API_ORIGIN}/v1/events`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'real', events: [] }) })
    );
    await page.route(`${API_ORIGIN}/v1/shares`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'real', shares: [] }) })
    );
    await page.route(`${API_ORIGIN}/v1/commands`, async (route) => {
      commandPosts += 1;
      lastCommandBody = route.request().postDataJSON() as Record<string, unknown>;
      if (force428) {
        await route.fulfill({
          status: 428,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'explicit_user_confirmation_required' }),
        });
        return;
      }
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true, command: 'lock_session', status: 'queued_for_device' }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Onaylı İşlemler' }).click();

    await page.getByRole('button', { name: 'Cihazı Kilitle' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    expect(commandPosts).toBe(0);

    await page.getByRole('button', { name: 'Cihazı Kilitle' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'İşlemi onayla' }).click();
    expect(commandPosts).toBe(1);
    expect(lastCommandBody).toEqual({
      command: 'lock_session',
      target_device_id: 'enc_dev_e2e_1',
      explicit_user_confirmation: true,
    });
    await expect(page.getByText('İşlem cihaz kuyruğuna alındı')).toBeVisible();

    force428 = true;
    await page.getByRole('button', { name: 'Oturum Kilidini Yenile' }).first().click();
    await page.getByRole('button', { name: 'İşlemi onayla' }).click();
    await expect(page.getByText('Kullanıcı onayı gerekli')).toBeVisible();
  });

  test('4. Paylaşım iptali: Vazgeç sırasında DELETE yapılmaz, onayda DELETE gönderilir ve 428 işlenir', async ({ page }) => {
    let deleteCount = 0;
    let force428 = false;

    await page.route(`${API_ORIGIN}/healthz`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) })
    );
    await page.route(`${API_ORIGIN}/readyz`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ready' }) })
    );
    await page.route(`${API_ORIGIN}/v1/devices`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'real',
          devices: [
            { device_id: 'enc_dev_e2e_1', hostname: 'ofis-is-istasyonu', platform: 'windows', status: 'active' },
          ],
        }),
      })
    );
    await page.route(`${API_ORIGIN}/v1/events`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'real', events: [] }) })
    );
    await page.route(`${API_ORIGIN}/v1/shares`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'real',
          shares: [
            {
              share_id: 'shr-e2e-100',
              device_id: 'enc_dev_e2e_1',
              active: true,
              expires_at: '2026-12-20T12:00:00Z',
              revoked_at: null,
              access_count: 0,
            },
          ],
        }),
      })
    );
    await page.route(`${API_ORIGIN}/v1/shares/shr-e2e-100`, async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCount += 1;
        if (force428) {
          await route.fulfill({
            status: 428,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'explicit_user_confirmation_required' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            share_id: 'shr-e2e-100',
            active: false,
            revoked_at: '2026-11-19T10:15:00Z',
          }),
        });
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Güvenli Paylaşımlar' }).click();

    await page.getByRole('button', { name: 'Paylaşımı İptal Et' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    expect(deleteCount).toBe(0);

    force428 = true;
    await page.getByRole('button', { name: 'Paylaşımı İptal Et' }).first().click();
    await page.getByRole('button', { name: 'Paylaşımı iptal et' }).click();
    expect(deleteCount).toBe(1);
    await expect(page.getByText('Kullanıcı onayı gerekli')).toBeVisible();

    force428 = false;
    await page.getByRole('button', { name: 'Paylaşımı İptal Et' }).first().click();
    await page.getByRole('button', { name: 'Paylaşımı iptal et' }).click();
    expect(deleteCount).toBe(2);
    await expect(page.getByText('Paylaşım iptal edildi')).toBeVisible();
  });

  test('5. Video hero görünür, Türkçe altyazı ve oynat/sessiz/indirme kontrolleri çalışır', async ({ page }) => {
    await page.route(`${API_ORIGIN}/**`, (route) => route.abort());
    await page.goto('/');

    const video = page.locator('video').first();
    await expect(video).toBeVisible();

    const track = video.locator('track[kind="captions"][srclang="tr"]');
    await expect(track).toHaveAttribute('src', '/media/aegis-gozcu-tanitim.tr.vtt');

    const pauseBtn = page.getByRole('button', { name: /Duraklat|Oynat/ }).first();
    await pauseBtn.click();

    const muteBtn = page.getByRole('button', { name: /Sesi aç|Sesi kapat/i }).first();
    await muteBtn.click();

    const mp4Link = page.locator('a[href="/media/aegis-gozcu-tanitim.mp4"]').first();
    const vttLink = page.locator('a[href="/media/aegis-gozcu-tanitim.tr.vtt"]').first();
    await expect(mp4Link).toHaveAttribute('download', 'aegis-gozcu-tanitim.mp4');
    await expect(vttLink).toHaveAttribute('download', 'aegis-gozcu-tanitim.tr.vtt');

    const mp4Resp = await page.request.get('/media/aegis-gozcu-tanitim.mp4');
    expect(mp4Resp.status()).toBe(200);
    const vttResp = await page.request.get('/media/aegis-gozcu-tanitim.tr.vtt');
    expect(vttResp.status()).toBe(200);
  });
});
