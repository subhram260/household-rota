import React, { useEffect, useState } from "react";

// Days and Months constants
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SECRET = "kitchen123";

// Updated to the 4 individuals for Utensils and 5 for Garbage
const DEFAULT_UTENSILS_MEMBERS = ["Aman", "Subhram", "Chinmaya", "Pritam"];
const DEFAULT_GARBAGE_MEMBERS = ["Rahul", "Priya", "Amit", "Sneha", "Vikram"];

const ROTA_API_URL = "/api/rota";
const ROTA_STORAGE_KEY = "household-rota:members";
const GARBAGE_APPROVALS_KEY = "household-rota:garbage-approvals";

// 12 working-day cycle matrix (Week 1 & Week 2, Mon to Sat)
// Member indices: 0: Aman, 1: Subhram, 2: Chinmaya, 3: Pritam
const TWO_WEEK_UTENSILS_CYCLE = [
  // --- Week 1 ---
  [0, 1], // Mon: Aman, Subhram
  [2, 3], // Tue: Chinmaya, Pritam
  [1, 0], // Wed: Subhram, Aman
  [3, 2], // Thu: Pritam, Chinmaya
  [0, 1], // Fri: Aman, Subhram
  [2, 3], // Sat: Chinmaya, Pritam

  // --- Week 2 ---
  [1, 0], // Mon: Subhram, Aman
  [3, 2], // Tue: Pritam, Chinmaya
  [0, 1], // Wed: Aman, Subhram
  [2, 3], // Thu: Chinmaya, Pritam
  [1, 0], // Fri: Subhram, Aman
  [3, 2], // Sat: Pritam, Chinmaya
];

// DST-safe offset date generation
function getDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDateKey(dateObj) {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
    dateObj.getDate()
  ).padStart(2, "0")}`;
}

// Anchored to Monday, Oct 5, 2026 (Week 1, Day 0)
function nonSundayIndexFromBase(targetDate) {
  const base = new Date(2026, 9, 5, 12, 0, 0); // Oct 5, 2026 is Monday
  const target = new Date(targetDate);
  target.setHours(12, 0, 0, 0);

  const diffDays = Math.round((target - base) / 86400000);

  let workingDays = 0;
  const step = diffDays >= 0 ? 1 : -1;
  const cur = new Date(base);

  for (let i = 0; i !== diffDays; i += step) {
    if (step > 0) cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) workingDays += step;
    if (step < 0) cur.setDate(cur.getDate() - 1);
  }

  return ((workingDays % 12) + 12) % 12;
}

// Rotation engine for Utensils (skipping Sundays)
function getUtensilsForDate(members, targetDate) {
  if (!members.length) return [null, null];
  if (targetDate.getDay() === 0) return [null, null];

  const rotationIndex = nonSundayIndexFromBase(targetDate);

  if (members.length === 4) {
    const [lunchIdx, dinnerIdx] = TWO_WEEK_UTENSILS_CYCLE[rotationIndex % 12];
    return [members[lunchIdx], members[dinnerIdx]];
  }

  return [
    members[rotationIndex % members.length],
    members[(rotationIndex + 1) % members.length],
  ];
}

function normalizeMembersList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((member) => typeof member === "string" && member.trim().length > 0);
  return cleaned.length ? cleaned : fallback;
}

function readStoredRota() {
  try {
    const stored = localStorage.getItem(ROTA_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return {
      utensils: normalizeMembersList(parsed?.utensils, DEFAULT_UTENSILS_MEMBERS),
      garbage: normalizeMembersList(parsed?.garbage, DEFAULT_GARBAGE_MEMBERS),
    };
  } catch {
    return null;
  }
}

function readStoredApprovals() {
  try {
    const stored = localStorage.getItem(GARBAGE_APPROVALS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Member avatar color palette
function avatarColor(name) {
  const gradients = [
    "linear-gradient(135deg, #6366f1, #4f46e5)", // Indigo
    "linear-gradient(135deg, #0ea5e9, #0284c7)", // Sky
    "linear-gradient(135deg, #10b981, #059669)", // Emerald
    "linear-gradient(135deg, #f59e0b, #d97706)", // Amber
    "linear-gradient(135deg, #ef4444, #dc2626)", // Red
    "linear-gradient(135deg, #8b5cf6, #7c3aed)", // Violet
    "linear-gradient(135deg, #ec4899, #db2777)", // Pink
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % gradients.length;
  }
  return gradients[h];
}

function Avatar({ name, size = 36 }) {
  return (
    <span
      className="inline-flex items-center justify-center font-extrabold text-white shrink-0 select-none shadow-md"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarColor(name),
        fontSize: size * 0.4,
      }}
    >
      {name ? name[0].toUpperCase() : "?"}
    </span>
  );
}

function LockIcon({ open, className = "w-5 h-5" }) {
  return open ? (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 019.9-1" />
    </svg>
  ) : (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function ArrowUpIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );
}

function ArrowDownIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function TrashIcon({ className = "w-4.5 h-4.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("utensils"); // 'utensils' or 'Garbage'

  const [utensilsMembers, setUtensilsMembers] = useState(() => readStoredRota()?.utensils || DEFAULT_UTENSILS_MEMBERS);
  const [GarbageMembers, setGarbageMembers] = useState(() => readStoredRota()?.garbage || DEFAULT_GARBAGE_MEMBERS);

  // Approval records for Garbage duty: { "YYYY-MM-DD": { [memberName]: "approved" | "missed" } }
  const [garbageApprovals, setGarbageApprovals] = useState(readStoredApprovals);

  const [input, setInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showPwInput, setShowPwInput] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [errorNotification, setErrorNotification] = useState("");

  const [customSearchDate, setCustomSearchDate] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const [copied, setCopied] = useState(false);
  const [daysCount, setDaysCount] = useState(12);
  const [rotaLoaded, setRotaLoaded] = useState(false);

  const currentMembersList = activeTab === "utensils" ? utensilsMembers : GarbageMembers;

  const todayDateObj = getDate(0);
  const todayKey = formatDateKey(todayDateObj);
  const isTodaySunday = todayDateObj.getDay() === 0;

  useEffect(() => {
    let cancelled = false;

    const loadRota = async () => {
      try {
        const response = await fetch(ROTA_API_URL);
        if (!response.ok) throw new Error(`Failed to load rota (${response.status})`);
        const data = await response.json();

        if (cancelled) return;

        if (!data?.fallback) {
          setUtensilsMembers(normalizeMembersList(data?.members?.utensils, DEFAULT_UTENSILS_MEMBERS));
          setGarbageMembers(normalizeMembersList(data?.members?.garbage, DEFAULT_GARBAGE_MEMBERS));
          localStorage.setItem(
            ROTA_STORAGE_KEY,
            JSON.stringify({
              utensils: normalizeMembersList(data?.members?.utensils, DEFAULT_UTENSILS_MEMBERS),
              garbage: normalizeMembersList(data?.members?.garbage, DEFAULT_GARBAGE_MEMBERS),
            })
          );
        }
      } catch {
        if (!cancelled) console.warn("JSON backend unavailable; using local data.");
      } finally {
        if (!cancelled) setRotaLoaded(true);
      }
    };

    loadRota();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rotaLoaded) return;

    const timeoutId = window.setTimeout(() => {
      fetch(ROTA_API_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: { utensils: utensilsMembers, garbage: GarbageMembers },
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Save failed (${response.status})`);
          const result = await response.json();
          if (result?.fallback) {
            localStorage.setItem(
              ROTA_STORAGE_KEY,
              JSON.stringify({ utensils: utensilsMembers, garbage: GarbageMembers })
            );
          }
        })
        .catch(() => {
          localStorage.setItem(
            ROTA_STORAGE_KEY,
            JSON.stringify({ utensils: utensilsMembers, garbage: GarbageMembers })
          );
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [GarbageMembers, rotaLoaded, utensilsMembers]);

  const toggleGarbageStatus = (dateKey, member, status) => {
    setGarbageApprovals((prev) => {
      const dayData = prev[dateKey] || {};
      const newStatus = dayData[member] === status ? null : status;
      const updated = {
        ...prev,
        [dateKey]: {
          ...dayData,
          [member]: newStatus,
        },
      };
      localStorage.setItem(GARBAGE_APPROVALS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const getUpcomingNonSundays = (count) => {
    const list = [];
    let current = new Date();
    current.setHours(12, 0, 0, 0);

    while (list.length < count) {
      current.setDate(current.getDate() + 1);
      if (current.getDay() !== 0) {
        list.push(new Date(current));
      }
    }
    return list;
  };

  const add = () => {
    const name = input.trim();
    if (!name) return;

    const existing = currentMembersList.map((m) => m.toLowerCase());
    if (existing.includes(name.toLowerCase())) {
      setErrorNotification(`"${name}" is already listed on this rota.`);
      return;
    }

    if (activeTab === "utensils") {
      setUtensilsMembers((p) => [...p, name]);
    } else {
      setGarbageMembers((p) => [...p, name]);
    }
    setInput("");
  };

  const remove = (name) => {
    if (activeTab === "utensils") {
      setUtensilsMembers((p) => p.filter((m) => m !== name));
    } else {
      setGarbageMembers((p) => p.filter((m) => m !== name));
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const list = [...currentMembersList];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;

    if (activeTab === "utensils") {
      setUtensilsMembers(list);
    } else {
      setGarbageMembers(list);
    }
  };

  const moveDown = (index) => {
    if (index === currentMembersList.length - 1) return;
    const list = [...currentMembersList];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;

    if (activeTab === "utensils") {
      setUtensilsMembers(list);
    } else {
      setGarbageMembers(list);
    }
  };

  const handleLockClick = () => {
    if (unlocked) {
      setUnlocked(false);
      setShowPwInput(false);
      setPwInput("");
    } else {
      setShowPwInput((s) => !s);
      setPwError(false);
      setPwInput("");
    }
  };

  const handlePwSubmit = () => {
    if (pwInput === SECRET) {
      setUnlocked(true);
      setShowPwInput(false);
      setPwInput("");
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput("");
    }
  };

  const handleDateSearch = (e) => {
    const targetDateStr = e.target.value;
    setCustomSearchDate(targetDateStr);
    if (!targetDateStr) {
      setSearchResults(null);
      return;
    }

    const targetDate = new Date(targetDateStr);
    targetDate.setHours(12, 0, 0, 0);

    const [lunch, dinner] = getUtensilsForDate(currentMembersList, targetDate);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffTime = targetDate - today;
    const offset = Math.round(diffTime / 86400000);

    setSearchResults({
      date: targetDate,
      lunch,
      dinner,
      offset,
      isSunday: targetDate.getDay() === 0,
      searchDateKey: formatDateKey(targetDate),
    });
  };

  const copyRotaText = () => {
    if (activeTab === "utensils") {
      const lines = [
        `📅 🍜 Utensils Duty Rota — Commencing ${getDate(0).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
      ];

      const nextDays = getUpcomingNonSundays(daysCount);
      nextDays.forEach((d) => {
        const [lunch, dinner] = getUtensilsForDate(currentMembersList, d);
        const dayStr = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
        lines.push(`${dayStr} -> Lunch: ${lunch || "No duty"} | Dinner: ${dinner || "No duty"}`);
      });

      const textToCopy = lines.join("\n");
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      const todayData = garbageApprovals[todayKey] || {};
      const lines = [
        `🗑️ Garbage Cleaning Verification — ${todayDateObj.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
      ];

      GarbageMembers.forEach((member) => {
        const status = todayData[member];
        const statusIcon = status === "approved" ? "✅ Cleaned" : status === "missed" ? "❌ Missed" : "⏳ Pending Approval";
        lines.push(`• ${member}: ${statusIcon}`);
      });

      const textToCopy = lines.join("\n");
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [todayLunch, todayDinner] = getUtensilsForDate(utensilsMembers, todayDateObj);
  const upcomingDays = getUpcomingNonSundays(daysCount);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 sm:p-6 md:py-10">
      <div className="w-full max-w-5xl space-y-6">
        {/* Error Notification Banner */}
        {errorNotification && (
          <div className="bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl p-5 flex items-start justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="font-bold text-base">{errorNotification}</p>
            </div>
            <button
              onClick={() => setErrorNotification("")}
              className="text-rose-500 hover:text-rose-700 font-extrabold text-xl px-2 hover:bg-rose-100 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        )}

        {/* Task Menu Header */}
        <nav className="grid grid-cols-2 p-2 bg-slate-200/70 border-2 border-slate-300/40 rounded-2xl gap-2">
          <button
            onClick={() => {
              setActiveTab("utensils");
              setSearchResults(null);
              setCustomSearchDate("");
            }}
            className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black text-base transition duration-200 active:scale-95 ${
              activeTab === "utensils"
                ? "bg-indigo-600 text-white shadow-md border-b-4 border-indigo-800"
                : "text-slate-600 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            <span className="text-xl">🍜</span>
            <span>Utensils Rota</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("Garbage");
              setSearchResults(null);
              setCustomSearchDate("");
            }}
            className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black text-base transition duration-200 active:scale-95 ${
              activeTab === "Garbage"
                ? "bg-amber-600 text-white shadow-md border-b-4 border-amber-800"
                : "text-slate-600 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            <span className="text-xl">🗑️</span>
            <span>Garbage Approvals</span>
          </button>
        </nav>

        {/* Compact Navigation Bar */}
        <header className="flex items-center justify-between gap-4 pb-4 border-b-2 border-slate-200">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-full text-sm font-extrabold tracking-wider uppercase transition ${
              activeTab === "utensils"
                ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                : "bg-amber-50 border-amber-100 text-amber-700"
            }`}
          >
            <span>{activeTab === "utensils" ? "🍽️" : "🗑️"}</span>
            <span>
              {activeTab === "utensils" ? "Active: Utensils (2-Week Cycle)" : "Active: Garbage Verification Roster"}
            </span>
          </div>

          <button
            onClick={copyRotaText}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 active:scale-95 transition text-slate-800 font-bold px-4 py-2.5 rounded-xl border-2 border-slate-200 shadow-sm text-sm"
          >
            {copied ? (
              <>
                <span className="text-emerald-600 font-extrabold text-base">✓</span> Copied
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>{activeTab === "utensils" ? "Share Rota" : "Share Statuses"}</span>
              </>
            )}
          </button>
        </header>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Active Views */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {activeTab === "utensils" ? (
              <>
                {/* Utensils View */}
                {isTodaySunday ? (
                  <section className="bg-gradient-to-r from-emerald-950 to-teal-900 text-white rounded-3xl shadow-lg p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                      <div>
                        <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-300">WEEKEND STATUS</span>
                        <h2 className="text-2xl font-black">Today is Sunday</h2>
                      </div>
                      <span className="text-sm font-extrabold bg-emerald-800/85 text-emerald-100 px-4 py-2 rounded-xl border border-emerald-700/50">
                        ☕ Rest Day
                      </span>
                    </div>
                    <div className="bg-emerald-950/40 border-2 border-emerald-800/40 rounded-2xl p-6 text-center space-y-2">
                      <span className="text-4xl block">💆‍♂️</span>
                      <h3 className="text-lg font-extrabold text-emerald-100">No scheduled utensils duty today!</h3>
                      <p className="text-emerald-300 text-sm">Sunday is off. The rotation resumes on Monday.</p>
                    </div>
                  </section>
                ) : (
                  <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center justify-between border-b pb-4 mb-5 border-slate-100">
                      <div>
                        <span className="text-xs uppercase tracking-widest font-extrabold text-indigo-600">TODAY'S SHIFTS</span>
                        <h2 className="text-2xl font-black text-slate-800">
                          {DAYS[todayDateObj.getDay()]}, {todayDateObj.getDate()} {MONTHS[todayDateObj.getMonth()]}
                        </h2>
                      </div>
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
                        Day Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                        <Avatar name={todayLunch} size={48} />
                        <div>
                          <span className="text-xs font-black uppercase text-indigo-500 tracking-wider">Lunch Duty</span>
                          <h4 className="text-xl font-black text-slate-800">{todayLunch || "None"}</h4>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                        <Avatar name={todayDinner} size={48} />
                        <div>
                          <span className="text-xs font-black uppercase text-indigo-500 tracking-wider">Dinner Duty</span>
                          <h4 className="text-xl font-black text-slate-800">{todayDinner || "None"}</h4>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Upcoming Days Utensils Table */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-800">Upcoming Utensils Schedule</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDaysCount(6)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                          daysCount === 6 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        6 Days
                      </button>
                      <button
                        onClick={() => setDaysCount(12)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                          daysCount === 12 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        12 Days (Full Cycle)
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-100 text-xs font-black uppercase text-slate-400">
                          <th className="py-3 px-2">Date & Day</th>
                          <th className="py-3 px-2">Lunch</th>
                          <th className="py-3 px-2">Dinner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                        {upcomingDays.map((d, i) => {
                          const [lunch, dinner] = getUtensilsForDate(utensilsMembers, d);
                          return (
                            <tr key={i} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-2 font-bold text-slate-700">
                                {DAYS[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]}
                              </td>
                              <td className="py-3 px-2">
                                <span className="inline-flex items-center gap-2">
                                  <Avatar name={lunch} size={24} />
                                  {lunch}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="inline-flex items-center gap-2">
                                  <Avatar name={dinner} size={24} />
                                  {dinner}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              /* Garbage Approvals View */
              <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4 border-slate-100">
                  <div>
                    <span className="text-xs uppercase tracking-widest font-extrabold text-amber-600">DAILY CHECK-IN</span>
                    <h2 className="text-2xl font-black text-slate-800">
                      Garbage Verification ({DAYS[todayDateObj.getDay()]}, {todayDateObj.getDate()} {MONTHS[todayDateObj.getMonth()]})
                    </h2>
                  </div>
                  <span className="self-start sm:self-center text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                    Peer Approved
                  </span>
                </div>

                <p className="text-sm text-slate-600">
                  Did each member clear their waste or complete garbage cleaning today? Tap to approve or mark missed.
                </p>

                <div className="space-y-3">
                  {GarbageMembers.map((member) => {
                    const currentStatus = garbageApprovals[todayKey]?.[member];
                    return (
                      <div
                        key={member}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border-2 transition gap-3 ${
                          currentStatus === "approved"
                            ? "bg-emerald-50/70 border-emerald-300"
                            : currentStatus === "missed"
                            ? "bg-rose-50/70 border-rose-300"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={member} size={42} />
                          <div>
                            <h4 className="font-extrabold text-base text-slate-800">{member}</h4>
                            <span className="text-xs font-bold">
                              {currentStatus === "approved" && (
                                <span className="text-emerald-700">✅ Cleaned & Approved</span>
                              )}
                              {currentStatus === "missed" && <span className="text-rose-700">❌ Not Cleaned</span>}
                              {!currentStatus && <span className="text-slate-400">⏳ Pending Confirmation</span>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleGarbageStatus(todayKey, member, "approved")}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                              currentStatus === "approved"
                                ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1"
                                : "bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300"
                            }`}
                          >
                            ✓ Cleaned
                          </button>
                          <button
                            onClick={() => toggleGarbageStatus(todayKey, member, "missed")}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                              currentStatus === "missed"
                                ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-600 ring-offset-1"
                                : "bg-white hover:bg-rose-50 text-rose-700 border border-rose-300"
                            }`}
                          >
                            ✕ Missed
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: Member Order & Date Lookup */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Quick Date Lookup */}
            <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-800 mb-2">Check Any Date</h3>
              <p className="text-xs text-slate-500 mb-4">
                {activeTab === "utensils"
                  ? "Select a date to check lunch & dinner assignees."
                  : "Select a date to view garbage verification history."}
              </p>

              <input
                type="date"
                value={customSearchDate}
                onChange={handleDateSearch}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-700 focus:outline-indigo-500"
              />

              {searchResults && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase">
                    {DAYS[searchResults.date.getDay()]}, {searchResults.date.getDate()} {MONTHS[searchResults.date.getMonth()]}
                  </div>

                  {activeTab === "utensils" ? (
                    searchResults.isSunday ? (
                      <div className="text-emerald-600 font-extrabold text-sm">Sunday — No Utensil Duty</div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="font-bold text-slate-500">Lunch: </span>
                          <span className="font-black text-slate-800">{searchResults.lunch}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500">Dinner: </span>
                          <span className="font-black text-slate-800">{searchResults.dinner}</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-600">Garbage status on this date:</div>
                      {GarbageMembers.map((member) => {
                        const status = garbageApprovals[searchResults.searchDateKey]?.[member];
                        return (
                          <div key={member} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-700">{member}</span>
                            <span
                              className={`font-bold px-2 py-0.5 rounded ${
                                status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : status === "missed"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {status === "approved" ? "Cleaned" : status === "missed" ? "Missed" : "Unmarked"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Member Management */}
            <section className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    {activeTab === "utensils" ? "Utensils Members (4)" : "Garbage Members"}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {activeTab === "utensils" ? "Fixed for balanced cycle" : "Active housemates"}
                  </span>
                </div>
                <button
                  onClick={handleLockClick}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 border border-slate-200"
                  title={unlocked ? "Lock roster edits" : "Unlock roster edits"}
                >
                  <LockIcon open={unlocked} />
                </button>
              </div>

              {showPwInput && !unlocked && (
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Enter admin password..."
                    value={pwInput}
                    onChange={(e) => setPwInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePwSubmit()}
                    className="w-full text-sm border-2 rounded-xl p-2 font-medium"
                  />
                  {pwError && <p className="text-xs text-rose-600 font-bold">Incorrect password.</p>}
                  <button
                    onClick={handlePwSubmit}
                    className="w-full bg-slate-800 text-white rounded-xl py-2 font-bold text-xs hover:bg-slate-900"
                  >
                    Unlock
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {currentMembersList.map((member, index) => (
                  <li
                    key={member}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={member} size={30} />
                      <span className="font-extrabold text-sm text-slate-700">{member}</span>
                    </div>

                    {unlocked && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === currentMembersList.length - 1}
                          className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                        >
                          <ArrowDownIcon />
                        </button>
                        <button
                          onClick={() => remove(member)}
                          className="p-1 rounded hover:bg-rose-100 text-rose-600"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {unlocked && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Add member name..."
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 font-medium"
                  />
                  <button
                    onClick={add}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
