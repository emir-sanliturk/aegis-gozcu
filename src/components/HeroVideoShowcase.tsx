import React, { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Captions,
  Download,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ScreenId } from '../types/telemetry';
import { uiLabels } from '../uiLabels';

interface HeroVideoShowcaseProps {
  apiConnected: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export const HeroVideoShowcase: React.FC<HeroVideoShowcaseProps> = ({
  apiConnected,
  onNavigate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      void vid.play();
      setPlaying(true);
    } else {
      vid.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  };

  const toggleCaptions = () => {
    const vid = videoRef.current;
    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    if (vid && vid.textTracks && vid.textTracks.length > 0) {
      vid.textTracks[0].mode = next ? 'showing' : 'hidden';
    }
  };

  return (
    <section
      aria-label="Aegis Gözcü tanıtım özeti"
      className="bento-tile p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
    >
      <div className="lg:col-span-5 flex flex-col justify-between gap-4">
        <div className="space-y-2.5">
          <p className="font-mono text-[11px] font-medium text-[#2878A8]">
            {apiConnected ? uiLabels.realConnectionActive : uiLabels.awaitingConnection} · 30 sn Teknik Tanıtım
          </p>
          <h2 className="text-lg font-semibold text-[#102A43] text-balance leading-snug">
            Katmanlı mimari, strict CORS ve kullanıcı kontrollü olay yönetimi
          </h2>
          <p className="text-xs leading-relaxed text-[#486581]">
            Aegis Gözcü; tarayıcı arayüzü, ters vekil, Fastify API ve kalıcı veritabanı arasında
            açık kullanıcı onayı ile çalışır. Gerçek veri yoksa dürüst boş durumları korur.
          </p>
          <p className="font-mono text-[11px] text-[#627D98]">
            Katmanlı koruma · Sürekli izleme · Kullanıcı kontrolü · Bilinen riskler
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D9E2EC]">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#102A43] hover:bg-[#163B5C] text-white px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{playing ? 'Duraklat' : 'Oynat'}</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43] px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{muted ? 'Sesi Aç' : 'Sessiz'}</span>
          </button>

          <button
            type="button"
            onClick={toggleCaptions}
            aria-pressed={captionsEnabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43] px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Captions className="h-3.5 w-3.5" />
            <span>{captionsEnabled ? 'Altyazı Açık' : 'Altyazı Kapalı'}</span>
          </button>

          <a
            href="/media/aegis-gozcu-tanitim.mp4"
            download="aegis-gozcu-tanitim.mp4"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white hover:bg-[#F5F8FA] text-[#102A43] px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>MP4</span>
          </a>

          <a
            href="/media/aegis-gozcu-tanitim.tr.vtt"
            download="aegis-gozcu-tanitim.tr.vtt"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-white hover:bg-[#F5F8FA] text-[#102A43] px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>VTT</span>
          </a>

          <button
            type="button"
            onClick={() => onNavigate('promo')}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2878A8] hover:text-[#102A43] px-2 py-2 whitespace-nowrap shrink-0"
          >
            <span>Tam Tanıtım</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="relative w-full aspect-video border border-[#D9E2EC] bg-[#071A2B] overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover block"
            src="/media/aegis-gozcu-tanitim.mp4"
            poster="/media/aegis-gozcu-tanitim-poster.webp"
            autoPlay
            muted
            playsInline
            loop
            controls
            preload="metadata"
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              if (vid.textTracks && vid.textTracks.length > 0) {
                vid.textTracks[0].mode = captionsEnabled ? 'showing' : 'hidden';
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <track
              kind="captions"
              label="Türkçe"
              srcLang="tr"
              src="/media/aegis-gozcu-tanitim.tr.vtt"
              default
            />
          </video>
        </div>
      </div>
    </section>
  );
};
