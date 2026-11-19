import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromoScreen } from '../src/screens/PromoScreen';
import { HeroVideoShowcase } from '../src/components/HeroVideoShowcase';

describe('Aegis Gözcü 30s PromoScreen & HeroVideoShowcase', () => {
  it('renders Turkish promotional player, 6 scene markers, VTT/SRT/MP4/WebP assets, and sharp non-rounded styling', () => {
    const html = renderToStaticMarkup(<PromoScreen />);

    expect(html).toContain('Aegis Gözcü — Kişisel Güvenlik ve Olay Merkezi');
    expect(html).toContain('/media/aegis-gozcu-tanitim.mp4');
    expect(html).toContain('/media/aegis-gozcu-tanitim-poster.webp');
    expect(html).toContain('/media/aegis-gozcu-tanitim.tr.vtt');
    expect(html).toContain('/media/aegis-gozcu-tanitim.tr.srt');
    expect(html).toContain('0–5 sn');
    expect(html).toContain('5–10 sn');
    expect(html).toContain('10–16 sn');
    expect(html).toContain('16–21 sn');
    expect(html).toContain('21–26 sn');
    expect(html).toContain('26–30 sn');
    expect(html).toContain('Kullanıcı onayı olmadan işlem yapılmaz');
    expect(html).toContain('Gerçek veriyle çalışan güvenli operasyon altyapısı');
    expect(html).toContain('rounded-none');
  });

  it('renders interactive HeroVideoShowcase with autoplay muted loop captions and no absolute claims', () => {
    const heroHtml = renderToStaticMarkup(
      <HeroVideoShowcase apiConnected={false} onNavigate={() => undefined} />
    );

    expect(heroHtml).toContain('/media/aegis-gozcu-tanitim.mp4');
    expect(heroHtml).toContain('/media/aegis-gozcu-tanitim-poster.webp');
    expect(heroHtml).toContain('/media/aegis-gozcu-tanitim.tr.vtt');
    expect(heroHtml).toContain('kind="captions"');
    expect(heroHtml).toContain('srcLang="tr"');
    expect(heroHtml).toContain('autoPlay');
    expect(heroHtml).toContain('playsInline');
    expect(heroHtml).toContain('loop');
    expect(heroHtml).toContain('Katmanlı koruma · Sürekli izleme · Kullanıcı kontrolü · Bilinen riskler');
    expect(heroHtml).not.toContain('%100 güvenli');
    expect(heroHtml).not.toContain('tam koruma');
  });
});
