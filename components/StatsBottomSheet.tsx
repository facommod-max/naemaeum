"use client";

import { useEffect, useState } from "react";
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

export default function StatsBottomSheet({
  isOpen,
  onClose,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
}) {
  type MindResult = {
    text: string;
    angryPct: number;
    depressedPct: number;
    happyPct: number;
  } | null;

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [mindResult, setMindResult] = useState<MindResult>(null);
  const [stats, setStats] = useState<StatsData>({
    totalSessions: 0,
    emotions: {
      angry: { count: 0, taps: 0 },
      depressed: { count: 0, taps: 0 },
      happy: { count: 0, taps: 0 },
    },
  });

  useEffect(() => {
    if (isOpen && userId) {
      fetchStats(userId, activeTab);
    }
  }, [isOpen, userId, activeTab]);

  const fetchStats = async (uid: number, tab: 'today' | 'week' | 'month') => {
    setIsLoading(true);
    try {
      // KST 시작/끝 날짜 계산
      const now = new Date();
      const kstStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
      const kstDate = new Date(kstStr);

      let start, end;
      if (tab === 'week') {
        const day = kstDate.getDay();
        const diffToMonday = kstDate.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(kstDate);
        start.setDate(diffToMonday);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
      } else if (tab === 'month') {
        start = new Date(kstDate.getFullYear(), kstDate.getMonth(), 1);
        end = new Date(kstDate.getFullYear(), kstDate.getMonth() + 1, 0);
      } else {
        start = new Date(kstDate);
        end = new Date(kstDate);
      }

      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const startStr = `${fmt(start)}T00:00:00+09:00`;
      const endStr = `${fmt(end)}T23:59:59.999+09:00`;

      const { data, error } = await supabase
        .from("emotion_records")
        .select("emotion, tap_count")
        .eq("user_id", uid)
        .gte("recorded_at", startStr)
        .lte("recorded_at", endStr);

      if (error) {
        console.error("Failed to fetch stats", error);
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

      let angryWeight = 0;
      let depressedWeight = 0;
      let happyWeight = 0;

      data.forEach((record) => {
        let key: keyof StatsData["emotions"] | null = null;
        if (record.emotion === "화남") {
          key = "angry";
          angryWeight += Math.sqrt(record.tap_count || 0);
        } else if (record.emotion === "우울") {
          key = "depressed";
          depressedWeight += Math.sqrt(record.tap_count || 0);
        } else if (record.emotion === "행복") {
          key = "happy";
          happyWeight += Math.sqrt(record.tap_count || 0);
        }

        if (key) {
          newStats.emotions[key].count += 1;
          newStats.emotions[key].taps += record.tap_count || 0;
        }
      });

      setStats(newStats);

      if (data.length === 0) {
        setMindResult(null);
      } else {
        const totalWeight = angryWeight + depressedWeight + happyWeight;
        if (totalWeight > 0) {
          const angryPct = Math.round((angryWeight / totalWeight) * 100);
          const depressedPct = Math.round((depressedWeight / totalWeight) * 100);
          const happyPct = Math.round((happyWeight / totalWeight) * 100);

          let text = "";
          const pcts = [
            { name: "happy", val: happyPct },
            { name: "angry", val: angryPct },
            { name: "depressed", val: depressedPct }
          ].sort((a, b) => b.val - a.val);

          const top2 = [pcts[0].name, pcts[1].name];

          if (tab === 'today') {
            if (happyPct >= 65) text = "많이 웃었던 날";
            else if (angryPct >= 65) text = "마음에 불이 났던 날";
            else if (depressedPct >= 65) text = "마음이 조금 가라앉았던 날";
            else {
              if (pcts[0].val - pcts[2].val <= 15) text = "여러 마음이 오갔던 날";
              else {
                if (top2.includes("happy") && top2.includes("angry")) text = "웃다가 화도 났던 날";
                else if (top2.includes("happy") && top2.includes("depressed")) text = "웃음 사이로 마음이 흐렸던 날";
                else if (top2.includes("angry") && top2.includes("depressed")) text = "마음이 꽤 복잡했던 날";
              }
            }
          } else if (tab === 'week') {
            if (happyPct >= 65) text = "행복이 많이 머문 한 주";
            else if (angryPct >= 65) text = "마음에 불이 자주 났던 한 주";
            else if (depressedPct >= 65) text = "조금 가라앉아 있던 한 주";
            else {
              if (pcts[0].val - pcts[2].val <= 15) text = "여러 마음이 오간 한 주";
              else {
                if (top2.includes("happy") && top2.includes("angry")) text = "웃기도 하고 화도 났던 한 주";
                else if (top2.includes("happy") && top2.includes("depressed")) text = "웃음과 흐림이 함께한 한 주";
                else if (top2.includes("angry") && top2.includes("depressed")) text = "마음이 조금 복잡했던 한 주";
              }
            }
          } else if (tab === 'month') {
            if (happyPct >= 65) text = "행복이 많이 머문 한 달";
            else if (angryPct >= 65) text = "마음에 불이 자주 났던 한 달";
            else if (depressedPct >= 65) text = "조금 가라앉아 있던 한 달";
            else {
              if (pcts[0].val - pcts[2].val <= 15) text = "여러 마음이 오간 한 달";
              else {
                if (top2.includes("happy") && top2.includes("angry")) text = "웃기도 하고 화도 났던 한 달";
                else if (top2.includes("happy") && top2.includes("depressed")) text = "웃음과 흐림이 함께한 한 달";
                else if (top2.includes("angry") && top2.includes("depressed")) text = "마음이 조금 복잡했던 한 달";
              }
            }
          }

          setMindResult({ text, angryPct, depressedPct, happyPct });
        } else {
          setMindResult(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const getPeriodText = () => {
    if (activeTab === 'week') return "이번 주";
    if (activeTab === 'month') return "이번 달";
    return "오늘";
  };

  return (
    <>
      {/* Full Screen Slide-up View */}
      <div 
        className={`fixed bottom-0 left-0 right-0 w-full h-[100dvh] bg-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col px-6 py-4 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >

        {/* 닫기 아이콘 */}
        <div className="absolute top-4 right-4 z-10">
          <button 
            className="p-2 text-black active:opacity-50 transition-opacity"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 flex flex-col pt-4 max-w-md mx-auto w-full overflow-y-auto pb-10">
          
          {/* 상단 탭 */}
          <div className="flex flex-row gap-6 mb-10 text-lg text-gray-400">
            <button 
              className={`transition-colors ${activeTab === 'today' ? "font-bold text-black" : ""}`}
              onClick={() => setActiveTab('today')}
            >오늘</button>
            <button 
              className={`transition-colors ${activeTab === 'week' ? "font-bold text-black" : ""}`}
              onClick={() => setActiveTab('week')}
            >이번 주</button>
            <button 
              className={`transition-colors ${activeTab === 'month' ? "font-bold text-black" : ""}`}
              onClick={() => setActiveTab('month')}
            >이번 달</button>
          </div>

          {isLoading ? (
            <div className="w-full h-32 flex items-center justify-center text-gray-400">
              ...
            </div>
          ) : (
            <>
              <div className="mb-14 flex flex-col gap-2">
                <span className="text-sm font-bold text-black">{getPeriodText()}의 마음</span>
                {mindResult ? (
                  <>
                    <h2 className="text-3xl font-bold text-black tracking-tight">{mindResult.text}</h2>
                    <div className="text-sm text-black font-medium mt-1">
                      행복 {mindResult.happyPct}% · 화남 {mindResult.angryPct}% · 우울 {mindResult.depressedPct}%
                    </div>
                  </>
                ) : (
                  <h2 className="text-3xl font-bold text-black tracking-tight">아직 기록된 마음이 없어요</h2>
                )}
              </div>

              <h3 className="text-2xl font-bold mb-10 tracking-tight text-black">
                {getPeriodText()} <span className="text-3xl">{stats.totalSessions}</span>번 기록했어요
              </h3>

              <div className="flex flex-col gap-10 text-black">
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
