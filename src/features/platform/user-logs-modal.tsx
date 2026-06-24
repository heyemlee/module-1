"use client";

import { useState, useEffect } from "react";
import type { RenderingStat } from "@/server/platform/user-admin-repository";

export function UserLogsModal({
  userId,
  userName,
  onClose
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<RenderingStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/logs`);
        if (!res.ok) {
          throw new Error("Failed to fetch stats");
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
    fetchStats();
  }, [userId]);

  const totalCalls = stats?.reduce((sum, stat) => sum + stat.calls, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d2d2d7]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              Usage Stats: {userName}
            </h2>
            {stats && (
              <p className="text-[13px] text-[#6e6e73] mt-1">
                Total API Calls: <strong className="text-[#1d1d1f]">{totalCalls}</strong>
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && <div className="text-[#b42318] mb-4">{error}</div>}
          
          {!stats && !error && (
            <div className="flex justify-center items-center py-12">
              <div className="size-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {stats && stats.length === 0 && (
            <p className="text-center text-[#6e6e73] py-12">No usage data found for this user.</p>
          )}

          {stats && stats.length > 0 && (
            <div className="rounded-xl border border-[#d2d2d7] overflow-hidden">
              <div className="flex justify-between bg-[#f5f5f7] px-4 py-3 text-[11px] font-bold text-[#6e6e73] border-b border-[#d2d2d7]">
                <span>Date</span>
                <span>API Calls</span>
              </div>
              <div className="divide-y divide-[#d2d2d7]">
                {stats.map(stat => {
                  const d = new Date(stat.date);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  
                  return (
                    <div key={stat.date} className="flex justify-between px-4 py-3 text-[13px] hover:bg-[#f5f5f7] transition-colors">
                      <span className="text-[#1d1d1f] font-medium">
                        {formattedDate}
                      </span>
                      <span className="text-[#0066cc] font-semibold bg-[#e6f0fa] px-2 py-0.5 rounded-full">
                        {stat.calls} calls
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
