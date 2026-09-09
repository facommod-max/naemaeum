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
  depressed: "bg-purple-500",
  happy: "bg-green-500",
};

const emotionHex: Record<Emotion, string> = {
  angry: "#ef4444",      // bg-red-500
  depressed: "#a855f7",  // bg-purple-500
  happy: "#22c55e",      // bg-green-500
};

export default function Home() {
  const [activeEmotion, setActiveEmotion] = useState<Emotion | null>(null);
  const [tapCount, setTapCount] = useState(0);
  
  // 상태 업데이트 지연 방지를 위한 useRef 관리
  const tapCountRef = useRef(0);
  const activeEmotionRef = useRef<Emotion | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
    tapCountRef.current = 0;
    
    // 컬러가 천천히 내려간 후 초기 화면이 나타나도록 2000ms 지연
    setTimeout(() => {
      setActiveEmotion(null);
      activeEmotionRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 높이 계산 로직 (새로운 체감 곡선 적용 및 후반부 100% 도달 보정)
  const calculateHeight = () => {
    if (tapCount === 0 || !activeEmotion) return 0;
    
    // 기본 곡선 (100회에서 약 88%)
    let height = 100 * (1 - Math.exp(-Math.pow(tapCount, 0.9) / 30));
    
    // 100회 이후 구간부터 180회에 정확히 100%에 도달하도록 선형 보정 가산
    if (tapCount >= 180) {
      height = 100;
    } else if (tapCount > 100) {
      const progress = (tapCount - 100) / 80; // 0 ~ 1
      height += progress * 3; // 180회일 때 부족한 약 3%를 채워서 100%로 만듦
    }
    
    return Math.min(height, 100);
  };

  const fillHeight = calculateHeight();

  return (
    <div className="relative w-full h-[100dvh] bg-white dark:bg-black overflow-hidden select-none touch-none text-black dark:text-white">
      
      {/* 부드럽게 좌우로 기울어지는 수면 애니메이션 */}
      <style>{`
        @keyframes tiltWater {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(1.5deg); }
          75% { transform: rotate(-1.5deg); }
        }
        .animate-tilt {
          animation: tiltWater 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* 바닥에서 위로 차오르는 색상 영역 (회전 시 빈 공간 방지를 위해 좌우와 하단 여백 추가) */}
      <div 
        className={`absolute left-[-10%] w-[120%] transition-all pointer-events-none ${
          tapCount === 0 ? "duration-[2000ms] ease-in-out" : "duration-75 ease-out"
        }`}
        style={{
          height: `calc(${fillHeight}% + 100px)`,
          bottom: '-100px'
        }}
      >
        <div 
          className={`w-full h-full origin-top animate-tilt transition-all ${
            tapCount === 0 ? "duration-[2000ms] ease-in-out" : "duration-150 ease-out"
          } ${!activeEmotion ? "opacity-0" : ""}`}
          style={{ 
            opacity: activeEmotion ? 1 : 0,
            backgroundColor: activeEmotion ? `color-mix(in srgb, ${emotionHex[activeEmotion]} ${Math.max(15, fillHeight)}%, #ffffff)` : "transparent"
          }}
        />
      </div>

      {/* 연타 유도 TOUCH 텍스트 */}
      {activeEmotion && tapCount === 1 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-lg font-bold tracking-wide text-black dark:text-white">
            TOUCH
          </span>
        </div>
      )}

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

      {/* 초기 화면: 이미지 기반 감정 선택 */}
      {!activeEmotion && (
        <div className="absolute inset-0 flex flex-col px-6 pt-5 pb-12 z-10">
          {/* 상단 미니멀 로고 */}
          <div className="text-lg font-bold tracking-wide pointer-events-none">
            naemaum
          </div>

          {/* 감정 이미지 리스트 (화면 정중앙) */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-sm mx-auto">
            <EmotionImageButton
              src="/emotions/angry.png"
              alt="화가나"
              onPress={() => handleTouch("angry")}
            />
            <EmotionImageButton
              src="/emotions/sad.png"
              alt="우울해"
              onPress={() => handleTouch("depressed")}
            />
            <EmotionImageButton
              src="/emotions/happy.png"
              alt="행복해"
              onPress={() => handleTouch("happy")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmotionImageButton({
  src,
  alt,
  onPress,
}: {
  src: string;
  alt: string;
  onPress: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        onPress();
      }}
      className="p-4 transition-transform duration-75 active:scale-95"
    >
      <img 
        src={src} 
        alt={alt} 
        className="w-[120px] h-[120px] object-contain pointer-events-none select-none"
        draggable={false}
      />
    </button>
  );
}
