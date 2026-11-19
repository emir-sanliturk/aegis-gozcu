import React, { useEffect, useRef, useState } from 'react';
import { Download, Film, Play, Square, Volume2, VolumeX } from 'lucide-react';

interface PromoScene {
  id: string;
  rangeLabel: string;
  startSec: number;
  endSec: number;
  title: string;
  summary: string;
  onScreenTexts: string[];
}

const PROMO_SCENES: PromoScene[] = [
  {
    id: 's1',
    rangeLabel: '0–5 sn',
    startSec: 0,
    endSec: 5,
    title: 'Dünya → Türkiye → İstanbul',
    summary: 'Küresel görünümden Türkiye ve İstanbul koordinatına sinematik yakınlaşma.',
    onScreenTexts: ['Aegis Gözcü', 'Kişisel Güvenlik ve Olay Merkezi'],
  },
  {
    id: 's2',
    rangeLabel: '5–10 sn',
    startSec: 5,
    endSec: 10,
    title: 'Dijital Altyapı Ağ Haritası',
    summary: 'Birbirine bağlanan cihaz düğümleri, güvenli bağlantı çizgileri ve şifreli veri akışı.',
    onScreenTexts: ['Gerçek cihaz verisi', 'Güvenli olay takibi'],
  },
  {
    id: 's3',
    rangeLabel: '10–16 sn',
    startSec: 10,
    endSec: 16,
    title: 'Katmanlı Veri Akışı',
    summary: 'Tarayıcı → Nginx → Fastify API → PostgreSQL uçtan uca üretim mimarisi.',
    onScreenTexts: ['TLS · Reverse Proxy', 'Strict CORS · Session', 'Kalıcı gerçek veri'],
  },
  {
    id: 's4',
    rangeLabel: '16–21 sn',
    startSec: 16,
    endSec: 21,
    title: 'Güvenlik Katmanları',
    summary: 'Açık origin CORS listesi, HttpOnly / Secure / SameSite=Strict çerez ve internal Docker ağı.',
    onScreenTexts: ['Wildcard CORS yok', 'Kullanıcı verisi ve oturum korunur'],
  },
  {
    id: 's5',
    rangeLabel: '21–26 sn',
    startSec: 21,
    endSec: 26,
    title: 'Operasyon Konsolu (Dürüst Durum)',
    summary: 'Cihaz Ağı, Güvenlik Olayları ve Tanılama ekranlarında gerçek veri yoksa dürüst boş durum.',
    onScreenTexts: ['Bağlantı bekleniyor', 'Eşleşmiş cihaz yok', 'Gerçek olay kaydı yok'],
  },
  {
    id: 's6',
    rangeLabel: '26–30 sn',
    startSec: 26,
    endSec: 30,
    title: 'Onaylı İşlem Akışı ve Final',
    summary: 'Olay kartı → Onay ekranı → Komut kuyruğu ve sade kurumsal kapanış karesi.',
    onScreenTexts: [
      'Kullanıcı onayı olmadan işlem yapılmaz',
      'Güvenli · Gerçek Veri · Denetlenebilir',
      'Gerçek veriyle çalışan güvenli operasyon altyapısı',
    ],
  },
];

const VOICEOVER_SCRIPT =
  'Aegis Gözcü, kişisel güvenlik ve olay yönetimi için tasarlanmış gerçek veri odaklı bir merkezdir. Tarayıcıdan güvenli API katmanına, oradan kalıcı veritabanına uzanan mimarisiyle cihazları, olayları ve kullanıcı kontrollü işlemleri tek bir yapıda birleştirir. Strict CORS, güvenli oturum çerezleri, internal ağ izolasyonu ve açık kullanıcı onayı sayesinde her işlem denetlenebilir ve güvenli biçimde yürütülür.';

export const PromoScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    setSpeechSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechEnabled(false);
  };

  const startTurkishNarration = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(VOICEOVER_SCRIPT);
    utterance.lang = 'tr-TR';
    utterance.rate = 0.96;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeechEnabled(false);
    utterance.onerror = () => setSpeechEnabled(false);
    setSpeechEnabled(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePlayFromStart = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.pause();
      stopSpeech();
      return;
    }
    if (vid.currentTime >= 29.5) {
      vid.currentTime = 0;
    }
    void vid.play();
    if (vid.currentTime < 1.0 && speechSupported) {
      startTurkishNarration();
    }
  };

  const handleSeekScene = (startSec: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = startSec;
    setCurrentTime(startSec);
    void vid.play();
  };

  const activeScene =
    PROMO_SCENES.find((s) => currentTime >= s.startSec && currentTime < s.endSec) ??
    PROMO_SCENES[PROMO_SCENES.length - 1];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#C6D3DF] rounded-none p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-wider text-[#2E9B72]">
            <Film className="h-3.5 w-3.5" />
            <span>30 Saniyelik Kurumsal Tanıtım Animasyonu · 1920×1080 (16:9)</span>
          </div>
          <h1 className="text-xl font-bold text-[#071A2B] mt-1">
            Aegis Gözcü — Kişisel Güvenlik ve Olay Merkezi
          </h1>
          <p className="text-sm text-[#486581] mt-1">
            Gerçek veri mimarisi, katmanlı güvenlik sınırı ve kullanıcı onaylı işlem akışı tanıtımı.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleTogglePlayFromStart}
            className="inline-flex items-center gap-2 bg-[#071A2B] hover:bg-[#102A43] text-white text-xs font-semibold px-4 py-2.5 rounded-none transition-colors whitespace-nowrap"
          >
            {isPlaying ? (
              <>
                <Square className="h-3.5 w-3.5 text-[#F6C86E]" />
                <span>Durdur</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-[#6ED6C1]" />
                <span>Tanıtımı Oynat</span>
              </>
            )}
          </button>

          {speechSupported && (
            <button
              type="button"
              onClick={() => (speechEnabled ? stopSpeech() : startTurkishNarration())}
              className="inline-flex items-center gap-2 bg-white hover:bg-[#EAF0F5] text-[#102A43] border border-[#8FA3B8] text-xs font-semibold px-3.5 py-2.5 rounded-none transition-colors whitespace-nowrap"
            >
              {speechEnabled ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-[#D9822B]" />
                  <span>Sesli Anlatımı Durdur</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-[#2E9B72]" />
                  <span>Türkçe Sesli Anlatım (TTS)</span>
                </>
              )}
            </button>
          )}

          <a
            href="/media/aegis-gozcu-tanitim.mp4"
            download="aegis-gozcu-tanitim.mp4"
            className="inline-flex items-center gap-2 bg-[#2E9B72] hover:bg-[#237A59] text-white text-xs font-semibold px-3.5 py-2.5 rounded-none transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>MP4 İndir (1080p)</span>
          </a>

          <a
            href="/media/aegis-gozcu-tanitim.tr.vtt"
            download="aegis-gozcu-tanitim.tr.vtt"
            className="inline-flex items-center gap-2 bg-[#F5F8FA] hover:bg-[#EAF0F5] text-[#102A43] border border-[#C6D3DF] text-xs font-semibold px-3.5 py-2.5 rounded-none transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Altyazı (.VTT)</span>
          </a>

          <a
            href="/media/aegis-gozcu-tanitim.tr.srt"
            download="aegis-gozcu-tanitim.tr.srt"
            className="inline-flex items-center gap-2 bg-[#F5F8FA] hover:bg-[#EAF0F5] text-[#102A43] border border-[#C6D3DF] text-xs font-semibold px-3.5 py-2.5 rounded-none transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Altyazı (.SRT)</span>
          </a>
        </div>
      </div>

      <div className="bg-[#071A2B] border border-[#102A43] rounded-none p-2">
        <div className="relative w-full aspect-video bg-[#F5F8FA]">
          <video
            ref={videoRef}
            className="w-full h-full object-contain block"
            poster="/media/aegis-gozcu-tanitim-poster.webp"
            controls
            preload="metadata"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              stopSpeech();
            }}
          >
            <source src="/media/aegis-gozcu-tanitim.mp4" type="video/mp4" />
            <track
              kind="captions"
              src="/media/aegis-gozcu-tanitim.tr.vtt"
              srcLang="tr"
              label="Türkçe"
              default
            />
          </video>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-[#C6D3DF] rounded-none p-4">
          <div className="flex items-center justify-between border-b border-[#D9E2EC] pb-3 mb-3">
            <h2 className="text-sm font-bold text-[#071A2B]">
              Sahne Akışı (0–30 sn)
            </h2>
            <span className="font-mono text-xs text-[#2E9B72] font-semibold">
              Aktif: {activeScene.rangeLabel} · {activeScene.title}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROMO_SCENES.map((scene) => {
              const isActive = scene.id === activeScene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => handleSeekScene(scene.startSec)}
                  className={`text-left p-3.5 border rounded-none transition-colors ${
                    isActive
                      ? 'bg-[#071A2B] text-white border-[#071A2B]'
                      : 'bg-[#F5F8FA] hover:bg-[#EAF0F5] text-[#102A43] border-[#C6D3DF]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        isActive ? 'text-[#6ED6C1]' : 'text-[#2E9B72]'
                      }`}
                    >
                      {scene.rangeLabel}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        isActive ? 'text-[#F6C86E]' : 'text-[#627D98]'
                      }`}
                    >
                      Sahneye Git →
                    </span>
                  </div>
                  <p className="text-sm font-bold mt-1">{scene.title}</p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isActive ? 'text-white/80' : 'text-[#486581]'
                    }`}
                  >
                    {scene.summary}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {scene.onScreenTexts.map((txt) => (
                      <span
                        key={txt}
                        className={`font-mono text-[10px] px-2 py-0.5 border rounded-none ${
                          isActive
                            ? 'bg-[#102A43] text-[#6ED6C1] border-[#2E9B72]'
                            : 'bg-white text-[#102A43] border-[#C6D3DF]'
                        }`}
                      >
                        {txt}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-[#C6D3DF] rounded-none p-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-[#D9E2EC] pb-3 mb-3">
              <span className="font-mono text-[11px] font-bold text-[#D9822B] uppercase">
                Seslendirme Metni (Türkçe)
              </span>
              <h2 className="text-sm font-bold text-[#071A2B] mt-0.5">
                Kurumsal Dış Ses Senaryosu
              </h2>
            </div>
            <blockquote className="text-sm leading-relaxed text-[#102A43] bg-[#F5F8FA] border border-[#D9E2EC] p-3.5">
              “{VOICEOVER_SCRIPT}”
            </blockquote>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D9E2EC]">
            <p className="font-mono text-[11px] font-bold text-[#627D98] uppercase mb-2">
              Aktif Sahne Ekran Metinleri
            </p>
            <ul className="space-y-1.5">
              {activeScene.onScreenTexts.map((txt) => (
                <li
                  key={txt}
                  className="font-mono text-xs text-[#071A2B] bg-[#EAF0F5] px-2.5 py-1.5 border border-[#C6D3DF]"
                >
                  {txt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
