"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

// Supabase 클라이언트 초기화
const supabase = createClient();

type Emotion = "angry" | "depressed" | "happy";

interface EmotionRecord {
  id: number;
  emotion: string;
  tap_count: number;
  recorded_at: string;
}

const emotionLabels: Record<Emotion, string> = {
  angry: "화가남",
  depressed: "우울함",
  happy: "행복함",
};

export default function Home() {
  const [counts, setCounts] = useState({
    angry: 0,
    depressed: 0,
    happy: 0,
  });

  const [records, setRecords] = useState<EmotionRecord[]>([]);
  
  // 감정별로 타이머를 저장하기 위한 ref
  const timeoutsRef = useRef<{ [key in Emotion]?: NodeJS.Timeout }>({});

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from("emotion_records")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("최근 기록을 불러오는 중 오류 발생:", error);
      return;
    }

    if (data) {
      setRecords(data as EmotionRecord[]);
    }
  }, []);

  // 초기 렌더링 시 최근 기록 가져오기
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleTouch = (emotion: Emotion) => {
    setCounts((prev) => {
      const newCount = prev[emotion] + 1;

      // 기존 타이머 취소
      if (timeoutsRef.current[emotion]) {
        clearTimeout(timeoutsRef.current[emotion]!);
      }

      // 2초 뒤에 기록 확정 타이머 설정
      timeoutsRef.current[emotion] = setTimeout(() => {
        commitRecord(emotion, newCount);
      }, 2000);

      return {
        ...prev,
        [emotion]: newCount,
      };
    });
  };

  const commitRecord = async (emotion: Emotion, finalCount: number) => {
    const emotionName = emotionLabels[emotion];
    const recordedAt = new Date().toISOString();

    // Supabase에 저장
    const { error } = await supabase.from("emotion_records").insert({
      emotion: emotionName,
      tap_count: finalCount,
      recorded_at: recordedAt,
    });

    if (error) {
      console.error("기록 저장 중 오류 발생:", error);
      alert("기록 저장에 실패했습니다. 다시 시도해주세요.");
    } else {
      // 성공적으로 저장되면 데이터를 다시 불러와서 최근 기록을 업데이트
      fetchRecords();
    }

    // 해당 감정의 카운트 초기화
    setCounts((prev) => ({
      ...prev,
      [emotion]: 0,
    }));
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-white dark:bg-black text-black dark:text-white px-6 py-20">
      <main className="w-full max-w-sm flex flex-col items-center h-full">
        <h1 className="text-2xl font-light tracking-wide mb-24 text-center">
          지금 내 마음은?
        </h1>

        <div className="flex flex-col w-full gap-8">
          <EmotionButton
            label="화가남"
            count={counts.angry}
            onClick={() => handleTouch("angry")}
          />
          <EmotionButton
            label="우울함"
            count={counts.depressed}
            onClick={() => handleTouch("depressed")}
          />
          <EmotionButton
            label="행복함"
            count={counts.happy}
            onClick={() => handleTouch("happy")}
          />
        </div>

        {/* 최근 기록 표시 영역 (Supabase 연동) */}
        {records.length > 0 && (
          <div className="w-full mt-16 pt-8 border-t border-gray-100 dark:border-gray-900">
            <h2 className="text-sm font-medium text-gray-500 mb-4 px-2">최근 기록</h2>
            <div className="flex flex-col gap-3">
              {records.map((record) => (
                <div key={record.id} className="flex justify-between items-center px-4 py-3 rounded-2xl bg-gray-50 dark:bg-zinc-900/50">
                  <span className="text-base text-gray-800 dark:text-gray-200">
                    {record.emotion}
                  </span>
                  <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                    {record.tap_count}회
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EmotionButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-full py-8 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-sm transition-transform duration-100 active:scale-95 active:bg-gray-50 dark:active:bg-gray-900"
    >
      <span className="text-xl font-medium tracking-wide">{label}</span>
      {count > 0 && (
        <span className="absolute right-6 text-sm text-gray-400 font-light">
          {count}
        </span>
      )}
    </button>
  );
}
