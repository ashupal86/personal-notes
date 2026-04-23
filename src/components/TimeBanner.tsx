'use client';
import { useEffect, useState } from 'react';

interface TimeSlot {
  label: string;
  start: number;
  end: number;
  skyGradient: string;
  stars: boolean;
  sunX: number;
  moonVisible: boolean;
  moonX: number;
  transitioning: boolean;
}

const SLOTS: TimeSlot[] = [
  { label: 'night',     start: 0,  end: 5,  skyGradient: 'linear-gradient(185deg, #04041a 0%, #080828 50%, #0d0d35 100%)', stars: true,  sunX: -15, moonVisible: true,  moonX: 55,  transitioning: false },
  { label: 'sunrise',   start: 5,  end: 8,  skyGradient: 'linear-gradient(185deg, #0e0930 0%, #7b3f6e 40%, #f4a460 80%, #ffe08a 100%)',   stars: true,  sunX: 12,  moonVisible: true,  moonX: 82,  transitioning: true  },
  { label: 'morning',   start: 8,  end: 12, skyGradient: 'linear-gradient(185deg, #1a6fba 0%, #4aa8e8 50%, #87ceeb 100%)',                stars: false, sunX: 32,  moonVisible: false, moonX: -10, transitioning: false },
  { label: 'afternoon', start: 12, end: 17, skyGradient: 'linear-gradient(185deg, #1565c0 0%, #2196f3 45%, #64b5f6 100%)',                stars: false, sunX: 62,  moonVisible: false, moonX: -10, transitioning: false },
  { label: 'sunset',    start: 17, end: 20, skyGradient: 'linear-gradient(185deg, #1a0030 0%, #8b2252 35%, #e8603c 70%, #f4a460 100%)',   stars: true,  sunX: 88,  moonVisible: true,  moonX: 14,  transitioning: true  },
  { label: 'evening',   start: 20, end: 24, skyGradient: 'linear-gradient(185deg, #04041a 0%, #080828 50%, #100828 100%)',                stars: true,  sunX: 115, moonVisible: true,  moonX: 38,  transitioning: false },
];

function getSlot(hour: number) {
  return SLOTS.find(s => hour >= s.start && hour < s.end) ?? SLOTS[0];
}

const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x: (i * 137.508) % 100,
  y: (i * 73.1 + 7) % 75,
  r: i % 4 === 0 ? 0.38 : 0.2,
  delay: (i * 0.41) % 4,
  dur: 2 + (i % 3),
}));

const GREETING_BY_LABEL: Record<string, string> = {
  night: 'Good night', sunrise: 'Good morning', morning: 'Good morning',
  afternoon: 'Good afternoon', sunset: 'Good evening', evening: 'Good evening',
};

interface TimeBannerProps {
  onGreeting?: (g: string) => void;
}

export default function TimeBanner({ onGreeting }: TimeBannerProps) {
  const [enabled, setEnabled] = useState(true);
  const [slot,    setSlot]    = useState<TimeSlot>(SLOTS[4]); // safe SSR default
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem('pref_time_banner') === 'false') { setEnabled(false); return; }
    } catch {}

    const update = () => {
      const s = getSlot(new Date().getHours());
      setSlot(s);
      onGreeting?.(GREETING_BY_LABEL[s.label] ?? 'Hello');
    };
    update();
    const iv = setInterval(update, 60_000);

    const handler = (e: Event) => {
      const val = (e as CustomEvent<boolean>).detail;
      setEnabled(val);
      try { localStorage.setItem('pref_time_banner', String(val)); } catch {}
    };
    window.addEventListener('time-banner-toggle', handler);
    return () => { clearInterval(iv); window.removeEventListener('time-banner-toggle', handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || !enabled) return null;

  const { skyGradient, stars, sunX, moonVisible, moonX, transitioning, label } = slot;
  const isLight = label === 'morning' || label === 'afternoon';

  return (
    <>
      {/* ── Full-page fixed background ── */}
      <div
        aria-hidden
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: -1, background: skyGradient, transition: 'background 4s ease' }}
      >
        {/* Stars */}
        {stars && (
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 80">
            {STARS.map(s => (
              <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="white"
                style={{ animation: `twinkle-bg ${s.dur}s ${s.delay}s ease-in-out infinite` }}
              />
            ))}
          </svg>
        )}

        {/* Sun */}
        <div
          className="absolute"
          style={{
            bottom: '8%',
            left: `${sunX}%`,
            transform: 'translateX(-50%)',
            transition: 'left 3s ease-in-out',
            pointerEvents: 'none',
          }}
        >
          {/* outer glow */}
          <div style={{
            position: 'absolute', width: 130, height: 130,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,220,50,0.22) 0%, transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            filter: 'blur(18px)',
          }} />
          {/* disc */}
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 38%, #fff5a0, #ffca28)',
            boxShadow: '0 0 28px 10px rgba(255,200,20,0.4)',
            position: 'relative',
          }} />
        </div>

        {/* Moon */}
        {moonVisible && (
          <div
            className="absolute"
            style={{
              bottom: '12%',
              left: `${moonX}%`,
              transform: 'translateX(-50%)',
              transition: 'left 3s ease-in-out, opacity 2s ease',
              opacity: transitioning && sunX > 25 ? 0.3 : 0.88,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              position: 'absolute', width: 80, height: 80,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(180,210,255,0.18) 0%, transparent 70%)',
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              filter: 'blur(10px)',
            }} />
            <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'relative' }}>
              <defs>
                <mask id="m-crescent">
                  <circle cx="18" cy="18" r="17" fill="white" />
                  <circle cx="25" cy="13" r="13" fill="black" />
                </mask>
              </defs>
              <circle cx="18" cy="18" r="17" fill="#ddeeff" mask="url(#m-crescent)" />
            </svg>
          </div>
        )}

        {/* Clouds — day only */}
        {isLight && (
          <>
            <Cloud x="8%"  y="12%" opacity={0.55} scale={1.1}    speed={38} />
            <Cloud x="38%" y="7%"  opacity={0.42} scale={0.82}   speed={52} delay={7} />
            <Cloud x="68%" y="14%" opacity={0.38} scale={0.68}   speed={44} delay={14} />
            <Cloud x="85%" y="9%"  opacity={0.30} scale={0.58}   speed={60} delay={21} />
          </>
        )}

        {/* Horizon glow */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)',
        }} />
      </div>

      {/* ── Dismiss button (pointer-events on) ── */}
      <button
        onClick={() => {
          setEnabled(false);
          try { localStorage.setItem('pref_time_banner', 'false'); } catch {}
        }}
        title="Disable sky background"
        className="fixed top-3 right-3 z-[99] text-white/30 hover:text-white/70 transition-colors text-[10px] font-semibold tracking-widest uppercase px-2 py-1 rounded-md hover:bg-white/10"
      >
        Hide sky
      </button>

      <style>{`
        @keyframes twinkle-bg {
          0%, 100% { opacity: 0.15; }
          50%       { opacity: 0.9;  }
        }
        @keyframes cloud-drift {
          0%   { transform: translateX(0px);  }
          50%  { transform: translateX(22px); }
          100% { transform: translateX(0px);  }
        }
      `}</style>
    </>
  );
}

function Cloud({ x, y, opacity, scale, speed, delay = 0 }: {
  x: string; y: string; opacity: number; scale: number; speed: number; delay?: number;
}) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      animation: `cloud-drift ${speed}s ${delay}s ease-in-out infinite`,
      opacity,
    }}>
      <svg width={100 * scale} height={38 * scale} viewBox="0 0 100 38">
        <ellipse cx="50" cy="28" rx="44" ry="11" fill="white" />
        <ellipse cx="30" cy="22" rx="22" ry="15" fill="white" />
        <ellipse cx="62" cy="19" rx="24" ry="16" fill="white" />
        <ellipse cx="50" cy="15" rx="18" ry="14" fill="white" />
      </svg>
    </div>
  );
}
