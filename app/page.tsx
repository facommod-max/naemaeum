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
  const [userId, setUserId] = useState<number | null>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  
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
    const currentUserId = localStorage.getItem("user_id");

    // Supabase에 저장 (화면 표시 안함)
    const { error } = await supabase.from("emotion_records").insert({
      user_id: currentUserId ? Number(currentUserId) : null,
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

  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (storedUserId) {
      setUserId(Number(storedUserId));
    }
    setIsCheckingUser(false);
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
    <div className="relative w-full h-[100dvh] overflow-hidden bg-white select-none touch-none">
      
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

      {/* 사용자 체크 중 흰 배경 */}
      {isCheckingUser && <div className="absolute inset-0 z-40 bg-white" />}

      {/* 사용자 선택 화면 */}
      {!userId && !isCheckingUser && (
        <div className="absolute inset-0 flex flex-col z-30 bg-white">
          <div className="flex-none h-[80px] flex items-center px-6">
            <div className="text-lg font-bold tracking-wide text-black pointer-events-none">
              naemaum
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center -mt-20">
            <h2 className="text-2xl font-bold text-black mb-12 pointer-events-none">누구예요?</h2>
            <div className="flex flex-row gap-8">
              {[
                { id: 1, name: "심보성", avatar: "/avatars/simbosung.png" },
                { id: 2, name: "정주희", avatar: "/avatars/jeongjuhee.png" },
                { id: 3, name: "허혜란", avatar: "/avatars/heohyeran.png" },
              ].map((u) => (
                <button
                  key={u.id}
                  className="flex flex-col items-center gap-4 transition-transform active:scale-95"
                  onClick={() => {
                    localStorage.setItem("user_id", String(u.id));
                    localStorage.setItem("user_name", u.name);
                    setUserId(u.id);
                  }}
                >
                  <img src={u.avatar} alt={u.name} className="w-20 h-20 rounded-full object-cover select-none pointer-events-none" draggable={false} />
                  <span className="text-lg font-bold text-black pointer-events-none">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 초기 화면: 3등분 감정 선택 */}
      {userId && !activeEmotion && (
        <div className="absolute inset-0 flex flex-col z-10 bg-white">
          {/* 상단 헤더 영역 */}
          <div className="flex-none h-[80px] flex items-center justify-between px-6 bg-white z-20 relative">
            <div className="text-lg font-bold tracking-wide pointer-events-none text-black">
              naemaum
            </div>
            <button className="p-2 -mr-2 text-black active:opacity-50 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </button>
          </div>
          
          <div className="w-full h-[1px] bg-[#E5E5E5] shrink-0" />

          {/* 감정 선택 영역 */}
          <div className="flex-1 flex flex-col w-full">
            <EmotionSectionButton
              label="화난다"
              activeColorClass="active:bg-red-500 active:text-white"
              onPress={() => handleTouch("angry")}
            />
            <div className="w-full h-[1px] bg-[#E5E5E5] shrink-0" />
            <EmotionSectionButton
              label="우울해"
              activeColorClass="active:bg-purple-500 active:text-white"
              onPress={() => handleTouch("depressed")}
            />
            <div className="w-full h-[1px] bg-[#E5E5E5] shrink-0" />
            <EmotionSectionButton
              label="행복해"
              activeColorClass="active:bg-green-500 active:text-white"
              onPress={() => handleTouch("happy")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmotionSectionButton({
  label,
  activeColorClass,
  onPress,
}: {
  label: string;
  activeColorClass: string;
  onPress: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        onPress();
      }}
      className={`flex-1 w-full flex items-center justify-center bg-white text-black transition-colors duration-75 ${activeColorClass}`}
    >
      <span className="text-5xl font-bold pointer-events-none">
        {label}
      </span>
    </button>
  );
}
