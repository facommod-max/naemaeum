"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

// Supabase 클라이언트 초기화
const supabase = createClient();

type Emotion = "angry" | "depressed" | "happy";

const emotionLabels: Record<Emotion, string> = {
  angry: "화남",
  depressed: "우울",
  happy: "행복",
};

const emotionColors: Record<Emotion, string> = {
  angry: "bg-red-500",
  depressed: "bg-blue-500",
  happy: "bg-yellow-400",
};

const emotionHex: Record<Emotion, string> = {
  angry: "#ef4444",      // bg-red-500
  depressed: "#3b82f6",  // bg-blue-500
  happy: "#facc15",      // bg-yellow-400
};

export default function Home() {
  const [activeEmotion, setActiveEmotion] = useState<Emotion | null>(null);
  const [tapCount, setTapCount] = useState(0);
  
  // 상태 업데이트 지연 방지를 위한 useRef 관리
  const tapCountRef = useRef(0);
  const activeEmotionRef = useRef<Emotion | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveBackRef = useRef<SVGGElement>(null);
  const waveFrontRef = useRef<SVGGElement>(null);

  const playTickSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }
      
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const handleTouch = (emotion: Emotion) => {
    // 터치 효과음 재생
    playTickSound();

    // 물결 시각적 출렁임 (독립적인 2중 진폭 확대)
    if (waveBackRef.current && waveFrontRef.current) {
      waveBackRef.current.getAnimations().forEach(anim => anim.cancel());
      waveBackRef.current.animate(
        [
          { transform: 'scaleY(1)' },
          { transform: 'scaleY(1.8)' },
          { transform: 'scaleY(1)' }
        ],
        { duration: 160, easing: 'ease-out' }
      );

      waveFrontRef.current.getAnimations().forEach(anim => anim.cancel());
      waveFrontRef.current.animate(
        [
          { transform: 'scaleY(1)' },
          { transform: 'scaleY(1.4)' },
          { transform: 'scaleY(1)' }
        ],
        { duration: 120, easing: 'ease-out' }
      );
    }

    const isDifferentEmotion = activeEmotionRef.current !== emotion;

    if (isDifferentEmotion) {
      tapCountRef.current = 1;
      activeEmotionRef.current = emotion;
      setActiveEmotion(emotion);
    } else {
      tapCountRef.current += 1;
    }

    const currentCount = tapCountRef.current;
    
    // 화면 렌더링을 위해 state 업데이트
    setTapCount(currentCount);

    // 기존 타이머 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 새로운 2초 타이머 시작
    timeoutRef.current = setTimeout(() => {
      commitRecord(emotion, currentCount);
    }, 2000);
  };

  const commitRecord = async (emotion: Emotion, finalCount: number) => {
    if (finalCount <= 0) return;

    const emotionName = emotionLabels[emotion];
    const recordedAt = new Date().toISOString();

    // Supabase에 저장 (화면 표시 안함)
    const { error } = await supabase.from("emotion_records").insert({
      emotion: emotionName,
      tap_count: finalCount,
      recorded_at: recordedAt,
    });

    if (error) {
      console.error("[commitRecord] 기록 저장 중 오류 발생:", error);
    }

    // 게이지가 바닥으로 떨어지도록 카운트 0으로 설정
    setTapCount(0);
    
    // 색상과 물결이 사라지는 애니메이션 대기 후 상태 초기화
    setTimeout(() => {
      setActiveEmotion(null);
      tapCountRef.current = 0;
      activeEmotionRef.current = null;
    }, 300); 
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 높이 계산 로직 (새로운 체감 곡선 적용)
  const calculateHeight = () => {
    if (tapCount === 0 || !activeEmotion) return 0;
    
    // 1회 약 4.4%, 10회 약 25%, 50회 약 65%, 100회 약 84%, 200회 이상 95% 이상에 수렴하는 자연스러운 곡선
    const height = 100 * (1 - Math.exp(-Math.pow(tapCount, 0.8) / 22));
    return Math.min(height, 100);
  };

  const fillHeight = calculateHeight();

  return (
    <div className="relative w-full h-[100dvh] bg-white dark:bg-black overflow-hidden select-none touch-none text-black dark:text-white">
      
      {/* 제자리에서 위아래로 출렁이는 2개의 물결 레이어 애니메이션 */}
      <style>{`
        @keyframes waveMorphFront {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.35); }
        }
        @keyframes waveMorphBack {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.25); }
        }
        .animate-wave-front {
          animation: waveMorphFront 1.2s ease-in-out infinite;
        }
        .animate-wave-back {
          animation: waveMorphBack 1.7s ease-in-out infinite;
        }
      `}</style>

      {/* 바닥에서 위로 차오르는 색상 영역 */}
      <div 
        className={`absolute bottom-0 left-0 w-full transition-all duration-75 ease-out ${
          activeEmotion ? emotionColors[activeEmotion] : "bg-transparent"
        }`}
        style={{
          height: `${fillHeight}%`
        }}
      >
        {/* 제자리에서 파형이 변하는 상단 물결 SVG */}
        {activeEmotion && (
          <div 
            className="absolute top-0 left-0 w-full h-[24px] -translate-y-full pointer-events-none transition-opacity duration-300"
            style={{ opacity: fillHeight > 0 ? 1 : 0 }}
          >
            <div className="w-full h-full">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 400 20" 
                preserveAspectRatio="none" 
                className="w-full h-full"
              >
                {/* 뒤쪽 물결 (반대 위상) */}
                <g ref={waveBackRef} style={{ transformOrigin: "50% 100%" }}>
                  <path 
                    fill={emotionHex[activeEmotion]} 
                    opacity="0.5" 
                    className="animate-wave-back"
                    style={{ transformOrigin: "50% 100%" }}
                    d="M 0 10 Q 25 20 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10 L 400 20 L 0 20 Z" 
                  />
                </g>
                {/* 앞쪽 물결 (정방향 위상) */}
                <g ref={waveFrontRef} style={{ transformOrigin: "50% 100%" }}>
                  <path 
                    fill={emotionHex[activeEmotion]} 
                    opacity="1" 
                    className="animate-wave-front"
                    style={{ transformOrigin: "50% 100%" }}
                    d="M 0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10 L 400 20 L 0 20 Z" 
                  />
                </g>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* 화면 전체 터치 영역 */}
      {activeEmotion && (
        <div 
          className="absolute inset-0 z-20 cursor-pointer"
          onPointerDown={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            handleTouch(activeEmotion);
          }}
        />
      )}

      {/* 초기 화면: 버튼 3개 표시 */}
      {!activeEmotion && (
        <div className="absolute inset-0 flex flex-col items-center justify-between px-6 py-12 z-10">
          <h1 className="text-2xl font-light tracking-wide mt-8 pointer-events-none">
            지금 내 마음은?
          </h1>

          <div className="flex w-full max-w-sm gap-4 pb-8">
            <EmotionButton
              label="화남"
              onPress={() => handleTouch("angry")}
            />
            <EmotionButton
              label="우울"
              onPress={() => handleTouch("depressed")}
            />
            <EmotionButton
              label="행복"
              onPress={() => handleTouch("happy")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmotionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        onPress();
      }}
      className="flex-1 py-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 shadow-sm transition-transform duration-75 active:scale-90"
    >
      <span className="text-lg font-medium tracking-wide pointer-events-none">{label}</span>
    </button>
  );
}
