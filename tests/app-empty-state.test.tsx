import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { SharesScreen } from '../src/screens/SharesScreen';
import { ConfirmCommandDialog } from '../src/components/ConfirmActionDialog';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Aegis Gözcü App honest empty and real-data states', () => {
  it('renders all 5 honest empty states and triggers 0 fetch calls when apiConnected={false}, devices={[]}, incidents={[]}, shares={[]}', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const html = renderToStaticMarkup(
      <App apiConnected={false} devices={[]} incidents={[]} shares={[]} />
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain('Aegis Gözcü');
    expect(html).toContain('Kişisel Güvenlik ve Olay Merkezi');
    expect(html).toContain('Eşleşmiş cihaz yok');
    expect(html).toContain('Gerçek olay kaydı yok');
    expect(html).toContain('Veri yok');
    expect(html).toContain('Bağlantı bekleniyor');
    expect(html).toContain('Aktif paylaşım yok');

    // Demo hostnames must never leak when real devices/incidents are empty
    expect(html).not.toContain('win11-workstation');
    expect(html).not.toContain('macbook-pro-m3');
    expect(html).not.toContain('pixel-8-pro');
    expect(html).not.toContain('iphone-15');
  });

  it('renders connected state and supplied real device/incident props', () => {
    const html = renderToStaticMarkup(
      <App
        apiConnected={true}
        devices={[
          {
            id: 'dev-win-1',
            name: 'ofis-is-istasyonu',
            platform: 'Windows',
            status: 'active',
          },
        ]}
        incidents={[
          {
            id: 'inc-real-1',
            title: 'WFP Çıkış Kuralı Tetiklendi',
            description: 'Bilinmeyen süreç çıkış soketi engellendi.',
            severity: 'high',
            status: 'new',
            deviceId: 'dev-win-1',
            timestamp: '2026-11-17T20:00:00Z',
          },
        ]}
      />
    );

    expect(html).toContain('Gerçek veri bağlantısı');
    expect(html).toContain('Hazır');
    expect(html).toContain('Gerçek cihazlar');
    expect(html).toContain('Gerçek olay kayıtları');
    expect(html).toContain('WFP Çıkış Kuralı Tetiklendi');
    expect(html).not.toContain('Bağlantı bekleniyor');
    expect(html).not.toContain('Eşleşmiş cihaz yok');
    expect(html).not.toContain('Gerçek olay kaydı yok');
  });

  it('renders honest empty state on SharesScreen and accessible confirmation dialog labels', () => {
    const sharesHtml = renderToStaticMarkup(
      <SharesScreen
        dataMode="real"
        apiConnected={true}
        devices={[]}
        shares={[]}
        incidents={[]}
        onToggleEphemeralShare={() => undefined}
        onPurgeEvidence={() => undefined}
        onInspectIncident={() => undefined}
      />
    );

    expect(sharesHtml).toContain('Aktif paylaşım yok');
    expect(sharesHtml).not.toContain('share_token');

    const dialogHtml = renderToStaticMarkup(
      <ConfirmCommandDialog
        open={true}
        deviceName="ofis-is-istasyonu"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(dialogHtml).toContain('role="dialog"');
    expect(dialogHtml).toContain('İşlem onayı gerekiyor');
    expect(dialogHtml).toContain('Vazgeç');
    expect(dialogHtml).toContain('İşlemi onayla');
  });
});
