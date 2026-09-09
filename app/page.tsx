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
    
    // 부드러운 전환을 위해 약간의 지연 후 감정 초기화 (물이 빠져나가는 애니메이션 시간에 맞춤)
    setTimeout(() => {
      setActiveEmotion(null);
      activeEmotionRef.current = null;
    }, 500);
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
          tapCount === 0 ? "duration-500 ease-in-out" : "duration-75 ease-out"
        }`}
        style={{
          height: `calc(${fillHeight}% + 100px)`,
          bottom: '-100px'
        }}
      >
        <div 
          className={`w-full h-full origin-top animate-tilt transition-all duration-150 ${
            !activeEmotion ? "opacity-0" : ""
          }`}
          style={{ 
            opacity: fillHeight > 0 ? 1 : 0,
            backgroundColor: activeEmotion ? `color-mix(in srgb, ${emotionHex[activeEmotion]} ${Math.max(15, fillHeight)}%, #ffffff)` : "transparent"
          }}
        />
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

      {/* 초기 화면: 로고, 문구, 버튼 3개 표시 */}
      {!activeEmotion && (
        <div className="absolute inset-0 flex flex-col px-6 pt-12 pb-12 z-10">
          {/* 상단 텍스트 영역 */}
          <div className="flex-none">
            {/* 상단 로고 */}
            <div className="text-2xl font-black tracking-tighter mb-12 pointer-events-none">
              NAEMAUM
            </div>

            {/* 메인 문구 */}
            <h1 className="text-4xl font-extrabold tracking-tight pointer-events-none">
              지금 기분 어때?
            </h1>
          </div>

          {/* 감정 원형 버튼 (남은 여백의 정중앙 배치) */}
          <div className="flex-1 flex flex-col justify-center w-full max-w-[400px] mx-auto">
            <div className="flex w-full justify-between gap-4">
              <EmotionCircleButton
                label="화남"
                colorClass="bg-red-500 text-white"
                onPress={() => handleTouch("angry")}
              />
              <EmotionCircleButton
                label="우울"
                colorClass="bg-purple-500 text-white"
                onPress={() => handleTouch("depressed")}
              />
              <EmotionCircleButton
                label="행복"
                colorClass="bg-green-500 text-white"
                onPress={() => handleTouch("happy")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmotionCircleButton({
  label,
  colorClass,
  onPress,
}: {
  label: string;
  colorClass: string;
  onPress: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        onPress();
      }}
      className={`flex items-center justify-center flex-1 max-w-[115px] aspect-square rounded-full ${colorClass} transition-transform duration-75 active:scale-90`}
    >
      <span className="text-2xl font-bold tracking-tight pointer-events-none">{label}</span>
    </button>
  );
}
