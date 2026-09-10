"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type StatsData = {
  totalSessions: number;
  totalTaps: number;
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
  const [activeTab, setActiveTab] = useState<'today' | 'week'>('today');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<any[]>([]);

  const [mindResult, setMindResult] = useState<MindResult>(null);
  const [stats, setStats] = useState<StatsData>({
    totalSessions: 0,
    totalTaps: 0,
    emotions: {
      angry: { count: 0, taps: 0 },
      depressed: { count: 0, taps: 0 },
      happy: { count: 0, taps: 0 },
    },
  });

  const getKstTodayStr = () => {
    const now = new Date();
    const kstStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
    const kstDate = new Date(kstStr);
    const y = kstDate.getFullYear();
    const m = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (isOpen && userId) {
      if (activeTab === 'today') {
        setSelectedDate(getKstTodayStr());
        fetchData('today', userId);
      } else {
        if (!selectedDate) setSelectedDate(getKstTodayStr());
        fetchData('week', userId);
      }
    }
  }, [isOpen, userId, activeTab]);

  useEffect(() => {
    if (activeTab === 'week' && weekData && selectedDate && !isLoading) {
      const recordsForDate = weekData.filter(r => {
        const rKstStr = new Date(r.recorded_at).toLocaleString("en-US", { timeZone: "Asia/Seoul" });
        const rDate = new Date(rKstStr);
        const y = rDate.getFullYear();
        const m = String(rDate.getMonth() + 1).padStart(2, '0');
        const d = String(rDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === selectedDate;
      });
      processData(recordsForDate);
    }
  }, [selectedDate, weekData, activeTab, isLoading]);

  const fetchData = async (tab: 'today' | 'week', uid: number) => {
    setIsLoading(true);
    try {
      const now = new Date();
      const kstStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
      const kstDate = new Date(kstStr);

      let start = new Date(kstDate);
      let end = new Date(kstDate);

      if (tab === 'week') {
        const day = kstDate.getDay();
        const diffToMonday = kstDate.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diffToMonday);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
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
        .select("emotion, tap_count, recorded_at")
        .eq("user_id", uid)
        .gte("recorded_at", startStr)
        .lte("recorded_at", endStr);

      if (error) {
        console.error("Failed to fetch stats", error);
        return;
      }

      if (tab === 'week') {
        setWeekData(data);
      } else {
        processData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const processData = (data: any[]) => {
    const newStats: StatsData = {
      totalSessions: data.length,
      totalTaps: 0,
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
        newStats.totalTaps += record.tap_count || 0;
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

        setMindResult({ text, angryPct, depressedPct, happyPct });
      } else {
        setMindResult(null);
      }
    }
  };

  const getWeekDays = () => {
    const now = new Date();
    const kstStr = now.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
    const kstDate = new Date(kstStr);

    const day = kstDate.getDay();
    const diffToMonday = kstDate.getDate() - day + (day === 0 ? -6 : 1);
    
    const days = [];
    const names = ['월', '화', '수', '목', '금', '토', '일'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(kstDate);
      d.setDate(diffToMonday + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateStr = String(d.getDate()).padStart(2, '0');
      
      const fullDateStr = `${y}-${m}-${dateStr}`;

      let highestColor = 'bg-gray-100'; // default empty
      if (weekData.length > 0) {
        const dayRecords = weekData.filter(r => {
          const rKstStr = new Date(r.recorded_at).toLocaleString("en-US", { timeZone: "Asia/Seoul" });
          const rDate = new Date(rKstStr);
          const rY = rDate.getFullYear();
          const rM = String(rDate.getMonth() + 1).padStart(2, '0');
          const rD = String(rDate.getDate()).padStart(2, '0');
          return `${rY}-${rM}-${rD}` === fullDateStr;
        });

        if (dayRecords.length > 0) {
          let aW = 0, dW = 0, hW = 0;
          dayRecords.forEach(r => {
            if (r.emotion === "화남") aW += Math.sqrt(r.tap_count || 0);
            else if (r.emotion === "우울") dW += Math.sqrt(r.tap_count || 0);
            else if (r.emotion === "행복") hW += Math.sqrt(r.tap_count || 0);
          });
          const maxW = Math.max(aW, dW, hW);
          if (maxW === aW && aW > 0) highestColor = 'bg-red-500';
          else if (maxW === dW && dW > 0) highestColor = 'bg-purple-500';
          else if (maxW === hW && hW > 0) highestColor = 'bg-green-500';
        }
      }

      days.push({
        name: names[i],
        date: d.getDate(),
        fullDateStr,
        colorClass: highestColor
      });
    }
    return days;
  };

  const getFormattedSelectedDate = () => {
    if (!selectedDate) return "";
    const [y, m, date] = selectedDate.split('-');
    const dayIndex = new Date(`${selectedDate}T12:00:00Z`).getDay();
    const names = ['일', '월', '화', '수', '목', '금', '토'];
    return `${parseInt(m)}월 ${parseInt(date)}일 ${names[dayIndex]}요일`;
  };

  return (
    <>
      <div 
        className={`fixed bottom-0 left-0 right-0 w-full h-[100dvh] bg-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col px-6 py-4 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
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

        <div className="flex-1 flex flex-col pt-4 max-w-md mx-auto w-full overflow-y-auto pb-10">
          
          <div className="flex flex-row gap-6 mb-10 text-lg text-gray-400">
            <button 
              className={`transition-colors ${activeTab === 'today' ? "font-bold text-black" : ""}`}
              onClick={() => setActiveTab('today')}
            >오늘</button>
            <button 
              className={`transition-colors ${activeTab === 'week' ? "font-bold text-black" : ""}`}
              onClick={() => setActiveTab('week')}
            >주간</button>
          </div>

          {isLoading && activeTab === 'today' ? (
            <div className="w-full h-32 flex items-center justify-center text-gray-400">
              ...
            </div>
          ) : (
            <>
              {activeTab === 'week' && (
                <div className="w-full flex flex-row justify-between mb-10 text-black">
                  {getWeekDays().map((d) => {
                    const isSelected = selectedDate === d.fullDateStr;
                    return (
                      <button 
                        key={d.fullDateStr} 
                        className="flex flex-col items-center gap-3 active:opacity-50 transition-opacity"
                        onClick={() => setSelectedDate(d.fullDateStr)}
                      >
                        <span className={`text-sm ${isSelected ? 'font-bold text-black' : 'text-gray-500'}`}>
                          {d.name}
                        </span>
                        <span className={`text-sm ${isSelected ? 'font-bold text-black' : 'text-gray-500'}`}>
                          {d.date}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${d.colorClass}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === 'week' && (
                <span className="text-sm font-bold text-black mb-4 block">
                  {getFormattedSelectedDate()}
                </span>
              )}
              {activeTab === 'today' && (
                <span className="text-sm font-bold text-black mb-4 block">오늘의 마음</span>
              )}

              <div className="mb-14 flex flex-col gap-2">
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

              {mindResult && (
                <div className="flex flex-col gap-6 text-black mt-10 border-t border-gray-100 pt-8">
                  {/* 총 기록 */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">총 기록</span>
                    <span className="text-lg font-medium text-gray-700">{stats.totalSessions}회</span>
                  </div>

                  {/* 화남 */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">화남</span>
                    <span className="text-lg font-medium text-gray-700">
                      {stats.emotions.angry.count}회 · {stats.emotions.angry.taps}터치
                    </span>
                  </div>

                  {/* 우울 */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">우울</span>
                    <span className="text-lg font-medium text-gray-700">
                      {stats.emotions.depressed.count}회 · {stats.emotions.depressed.taps}터치
                    </span>
                  </div>

                  {/* 행복 */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">행복</span>
                    <span className="text-lg font-medium text-gray-700">
                      {stats.emotions.happy.count}회 · {stats.emotions.happy.taps}터치
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
