"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type StatsData = {
  totalSessions: number;
  emotions: {
    angry: { count: number; taps: number };
    depressed: { count: number; taps: number };
    happy: { count: number; taps: number };
  };
};

export default function StatsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    totalSessions: 0,
    emotions: {
      angry: { count: 0, taps: 0 },
      depressed: { count: 0, taps: 0 },
      happy: { count: 0, taps: 0 },
    },
  });

  useEffect(() => {
    const storedUserId = localStorage.getItem("user_id");
    if (!storedUserId) {
      router.push("/");
      return;
    }
    setUserId(Number(storedUserId));
    fetchStats(Number(storedUserId));
  }, [router]);

  const fetchStats = async (uid: number) => {
    try {
      const now = new Date();
      // KST 오늘 시작/끝 날짜 계산
      const kstDateString = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
      }).format(now);
      
      const startOfKstDay = new Date(`${kstDateString}T00:00:00+09:00`);
      const endOfKstDay = new Date(`${kstDateString}T23:59:59.999+09:00`);

      const { data, error } = await supabase
        .from("emotion_records")
        .select("emotion, tap_count")
        .eq("user_id", uid)
        .gte("recorded_at", startOfKstDay.toISOString())
        .lte("recorded_at", endOfKstDay.toISOString());

      if (error) {
        console.error("Failed to fetch stats", error);
        setIsLoading(false);
        return;
      }

      const newStats: StatsData = {
        totalSessions: data.length,
        emotions: {
          angry: { count: 0, taps: 0 },
          depressed: { count: 0, taps: 0 },
          happy: { count: 0, taps: 0 },
        },
      };

      data.forEach((record) => {
        let key: keyof StatsData["emotions"] | null = null;
        if (record.emotion === "화남") key = "angry";
        else if (record.emotion === "우울") key = "depressed";
        else if (record.emotion === "행복") key = "happy";

        if (key) {
          newStats.emotions[key].count += 1;
          newStats.emotions[key].taps += record.tap_count || 0;
        }
      });

      setStats(newStats);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!userId || isLoading) {
    return <div className="w-full h-[100dvh] bg-white" />;
  }

  return (
    <div className="relative w-full min-h-[100dvh] bg-white flex flex-col text-black px-6 py-5">
      {/* 상단 헤더 */}
      <div className="flex-none h-[80px] flex items-center justify-between z-20">
        <div className="text-lg font-bold tracking-wide pointer-events-none">
          naemaum
        </div>
        <button 
          className="p-2 -mr-2 active:opacity-50 transition-opacity"
          onClick={() => router.push("/")}
          aria-label="닫기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col pt-8 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold mb-14 tracking-tight">
          오늘 <span className="text-3xl">{stats.totalSessions}</span>번 기록했어요
        </h1>

        <div className="flex flex-col gap-10">
          {/* 화남 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">화남</span>
              <span className="text-2xl font-bold text-red-500">{stats.emotions.angry.count}</span>
            </div>
            <div className="text-sm text-gray-500">
              터치 수 합계 <span className="font-bold text-black ml-1">{stats.emotions.angry.taps}</span>
            </div>
          </div>

          {/* 우울 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">우울</span>
              <span className="text-2xl font-bold text-purple-500">{stats.emotions.depressed.count}</span>
            </div>
            <div className="text-sm text-gray-500">
              터치 수 합계 <span className="font-bold text-black ml-1">{stats.emotions.depressed.taps}</span>
            </div>
          </div>

          {/* 행복 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">행복</span>
              <span className="text-2xl font-bold text-green-500">{stats.emotions.happy.count}</span>
            </div>
            <div className="text-sm text-gray-500">
              터치 수 합계 <span className="font-bold text-black ml-1">{stats.emotions.happy.taps}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
