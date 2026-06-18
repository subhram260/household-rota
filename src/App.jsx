import React, { useEffect, useState } from "react";



// Days and Months constants

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SECRET = "kitchen123";

const DEFAULT_UTENSILS_MEMBERS = ["Alice", "Bob", "Charlie", "David", "Emma"];

const DEFAULT_GARBAGE_MEMBERS = ["Rahul", "Priya", "Amit", "Sneha", "Vikram"];

const ROTA_API_URL = "/api/rota";



// DST-safe offset date generation

function getDate(offset) {

  const d = new Date();

  d.setDate(d.getDate() + offset);

  return d;

}



// Calculate index skipping all Sundays since a fixed base date (Saturday, Jan 1, 2000)

function nonSundayIndexFromBase(targetDate) {

  const base = new Date(2000, 0, 1, 12, 0, 0); // Saturday

  const target = new Date(targetDate);

  target.setHours(12, 0, 0, 0);

  

  if (target <= base) return 0;

  

  const diffDays = Math.floor((target - base) / 86400000);

  

  // Saturdays = index 0. Sundays occur when diffDays index is 1, 8, 15, etc.

  let sundaysCount = 0;

  if (diffDays >= 1) {

    sundaysCount = Math.floor((diffDays - 1) / 7) + 1;

  }

  

  return diffDays - sundaysCount;

}



// Rotation engine skipping Sundays

function getAssigneesForDate(members, targetDate, shiftsPerDay = 2) {

  if (!members.length) return [null, null];

  

  // Sundays have no chores

  if (targetDate.getDay() === 0) {

    return [null, null];

  }

  

  const rotationIndex = nonSundayIndexFromBase(targetDate);

  if (shiftsPerDay === 1) {
    return [members[rotationIndex % members.length], null];
  }

  return [

    members[(rotationIndex * 2) % members.length],

    members[(rotationIndex * 2 + 1) % members.length],

  ];

}

function normalizeMembersList(value, fallback) {
  if (!Array.isArray(value)) return fallback;

  const cleaned = value.filter((member) => typeof member === "string" && member.trim().length > 0);
  return cleaned.length ? cleaned : fallback;
}



// Premium gradient colors for member avatars

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



// Customized Avatar Component with dynamic size scaling

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



// Standard SVG Icons

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

  // Navigation State

  const [activeTab, setActiveTab] = useState("utensils"); // 'utensils' or 'Garbage'



  // Rota Lists States

  const [utensilsMembers, setUtensilsMembers] = useState(DEFAULT_UTENSILS_MEMBERS);

  const [GarbageMembers, setGarbageMembers] = useState(DEFAULT_GARBAGE_MEMBERS);



  const [input, setInput] = useState("");

  const [unlocked, setUnlocked] = useState(false);

  const [showPwInput, setShowPwInput] = useState(false);

  const [pwInput, setPwInput] = useState("");

  const [pwError, setPwError] = useState(false);

  const [errorNotification, setErrorNotification] = useState("");



  // Search Shift Calculator States

  const [customSearchDate, setCustomSearchDate] = useState("");

  const [searchResults, setSearchResults] = useState(null);



  // Copy success indicator

  const [copied, setCopied] = useState(false);

  const [daysCount, setDaysCount] = useState(7); // Show next 7 or 14 non-Sunday days

  const [rotaLoaded, setRotaLoaded] = useState(false);



  // Get active rota list based on current selection

  const currentMembersList = activeTab === "utensils" ? utensilsMembers : GarbageMembers;

  const activeShiftCount = activeTab === "utensils" ? 2 : 1;

  useEffect(() => {
    let cancelled = false;

    const loadRota = async () => {
      try {
        const response = await fetch(ROTA_API_URL);

        if (!response.ok) {
          throw new Error(`Failed to load rota JSON (${response.status})`);
        }

        const data = await response.json();

        if (cancelled) return;

        setUtensilsMembers(normalizeMembersList(data?.members?.utensils, DEFAULT_UTENSILS_MEMBERS));
        setGarbageMembers(normalizeMembersList(data?.members?.garbage, DEFAULT_GARBAGE_MEMBERS));
      } catch {
        if (!cancelled) {
          console.warn("JSON backend is unavailable; using local roster data.");
        }
      } finally {
        if (!cancelled) {
          setRotaLoaded(true);
        }
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          members: {
            utensils: utensilsMembers,
            garbage: GarbageMembers,
          },
        }),
      }).catch((error) => {
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Save failed (${response.status})`);
          }

          const result = await response.json();
          if (result?.fallback) {
            console.warn("JSON backend is not configured yet; changes are only stored locally.");
          }
        })
        .catch((error) => {
          console.warn("Roster JSON backend is not available yet.", error);
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [GarbageMembers, rotaLoaded, utensilsMembers]);



  const getUpcomingNonSundays = (count) => {

    const list = [];

    let current = new Date();

    current.setHours(12, 0, 0, 0);

    

    while (list.length < count) {

      current.setDate(current.getDate() + 1);

      if (current.getDay() !== 0) { // Skip Sundays

        list.push(new Date(current));

      }

    }

    return list;

  };



  const add = () => {

    const name = input.trim();

    if (!name) return;

    

    const existing = currentMembersList.map(m => m.toLowerCase());

    if (existing.includes(name.toLowerCase())) {

      setErrorNotification(`"${name}" is already listed on this rota.`);

      return;

    }



    if (activeTab === "utensils") {

      setUtensilsMembers(p => [...p, name]);

    } else {

      setGarbageMembers(p => [...p, name]);

    }

    setInput("");

  };



  const remove = (name) => {

    if (activeTab === "utensils") {

      setUtensilsMembers(p => p.filter(m => m !== name));

    } else {

      setGarbageMembers(p => p.filter(m => m !== name));

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

      setShowPwInput(s => !s);

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



    const [lunch, dinner] = getAssigneesForDate(currentMembersList, targetDate, activeShiftCount);

    

    const today = new Date();

    today.setHours(12, 0, 0, 0);

    const diffTime = targetDate - today;

    const offset = Math.round(diffTime / 86400000);



    setSearchResults({

      date: targetDate,

      lunch,

      dinner,

      offset,

      isSunday: targetDate.getDay() === 0

    });

  };



  const copyWeeklyRotaText = () => {

    const titleEmoji = activeTab === "utensils" ? "🍜" : "🗑️";

    const titleName = activeTab === "utensils" ? "Utensils Duty" : "Garbage (Trash) Duty";

    const lines = [`📅 ${titleEmoji} ${titleName} Rota — Commencing ${getDate(0).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`];

    

    const nextDays = getUpcomingNonSundays(7);

    nextDays.forEach(d => {

      const [lunch, dinner] = getAssigneesForDate(currentMembersList, d, activeShiftCount);

      const dayStr = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

      

      if (activeTab === "utensils") {

        lines.push(`${dayStr} -> Lunch: ${lunch || "No duty"} | Dinner: ${dinner || "No duty"}`);

      } else {

        lines.push(`${dayStr} -> ${lunch || "No duty"}`);

      }

    });

    const textToCopy = lines.join("\n");



    const textArea = document.createElement("textarea");

    textArea.value = textToCopy;

    textArea.style.position = "fixed";

    textArea.style.top = "0";

    textArea.style.left = "0";

    document.body.appendChild(textArea);

    textArea.focus();

    textArea.select();

    try {

      document.execCommand("copy");

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);

    } catch (err) {

      console.error("Could not copy rota summary", err);

    }

    document.body.removeChild(textArea);

  };



  const todayDateObj = getDate(0);

  const isTodaySunday = todayDateObj.getDay() === 0;

  const [todayShift1, todayShift2] = getAssigneesForDate(currentMembersList, todayDateObj, activeShiftCount);



  // Label configuration based on Tab

  const shift1Emoji = activeTab === "utensils" ? "🍜" : "🌅";

  const shift1Label = activeTab === "utensils" ? "Lunch Duty" : "Morning Garbage";

  const shift1Details = activeTab === "utensils" ? "Utensils & Kitchen Clean" : "Wet Waste & Compost";



  const shift2Emoji = activeTab === "utensils" ? "🍽️" : "🌃";

  const shift2Label = activeTab === "utensils" ? "Dinner Duty" : "Night Garbage";

  const shift2Details = activeTab === "utensils" ? "Utensils & Kitchen Clean" : "Dry Waste & Recycling";



  return (

    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 sm:p-6 md:py-10">

      <div className="w-full max-w-5xl space-y-6">

        

        {/* Error Notification Banner */}

        {errorNotification && (

          <div className="bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl p-5 flex items-start justify-between shadow-sm animate-fadeIn">

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

        <nav className="grid grid-cols-2 p-2 bg-slate-200/70 border-2 border-slate-300/40 rounded-2xl gap-2 shadow-xs">

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

            <span>Garbage Rota</span>

          </button>

        </nav>



        {/* Compact Navigation Bar */}

        <header className="flex items-center justify-between gap-4 pb-4 border-b-2 border-slate-200">

          <div className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-full text-sm font-extrabold tracking-wider uppercase transition duration-300 ${

            activeTab === "utensils" 

              ? "bg-indigo-50 border-indigo-100 text-indigo-700" 

              : "bg-amber-50 border-amber-100 text-amber-700"

          }`}>

            <span>{activeTab === "utensils" ? "🍽️" : "🗑️"}</span>

            <span>Active: {activeTab === "utensils" ? "Utensils Duty" : "Garbage Duty"}</span>

          </div>

          <button

            onClick={copyWeeklyRotaText}

            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 active:scale-95 transition text-slate-800 font-bold px-4 py-2.5 rounded-xl border-2 border-slate-200 shadow-sm text-sm"

          >

            {copied ? (

              <>

                <span className="text-emerald-600 font-extrabold text-base">✓</span> Copied Rota

              </>

            ) : (

              <>

                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">

                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />

                </svg>

                <span>Share Weekly</span>

              </>

            )}

          </button>

        </header>



        {/* Dashboard Grid Layout */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          

          {/* LEFT: Active Schedules */}

          <div className="lg:col-span-7 xl:col-span-8 space-y-6">

            

            {/* Today's Duty Card */}

            {isTodaySunday ? (

              <section className="bg-gradient-to-r from-emerald-950 to-teal-900 text-white rounded-3xl shadow-lg overflow-hidden relative">

                <div className="p-6 sm:p-8">

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">

                    <div className="space-y-1">

                      <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-300">WEEKEND STATUS</span>

                      <h2 className="text-2xl font-black tracking-tight">Today is Sunday</h2>

                    </div>

                    <span className="self-start sm:self-center text-sm font-extrabold bg-emerald-800/85 text-emerald-100 px-4 py-2 rounded-xl border border-emerald-700/50">

                      ☕ Rest Day

                    </span>

                  </div>

                  <div className="bg-emerald-950/40 border-2 border-emerald-800/40 rounded-2xl p-6 text-center space-y-2">

                    <span className="text-4xl block">💆‍♂️</span>

                    <h3 className="text-lg font-extrabold text-emerald-200">Rotation Paused</h3>

                    <p className="text-sm text-emerald-300 max-w-md mx-auto">

                      All utensil and trash disposal tasks are suspended on Sundays. Normal kitchen duties will resume tomorrow on Monday.

                    </p>

                  </div>

                </div>

              </section>

            ) : (

              <section className={`transition-all duration-300 text-white rounded-3xl shadow-xl overflow-hidden relative ${

                activeTab === "utensils" 

                  ? "bg-slate-900 border-2 border-indigo-900/50" 

                  : "bg-slate-950 border-2 border-amber-950"

              }`}>

                <div className="p-6 sm:p-8">

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">

                    <div className="space-y-1">

                      <span className="text-xs uppercase tracking-widest font-extrabold text-indigo-300">Active Shift Block</span>

                      <h2 className="text-2xl font-black tracking-tight">Today's Roster</h2>

                    </div>

                    <span className="self-start sm:self-center text-sm font-extrabold bg-slate-800 text-slate-200 px-4 py-2 rounded-xl border border-slate-700">

                      📅 {DAYS[todayDateObj.getDay()]} — {todayDateObj.getDate()} {MONTHS[todayDateObj.getMonth()]}

                    </span>

                  </div>



                  {activeTab === "Garbage" ? (

                    <div className="rounded-2xl p-5 border-2 transition bg-slate-900/50 border-slate-800/40 hover:bg-slate-900/80">

                      <div className="flex items-center gap-3 mb-4">

                        <span className="text-3xl">🗑️</span>

                        <div>

                          <span className="text-xs uppercase tracking-wider text-slate-400 block font-black">Daily Garbage Duty</span>

                          <span className="text-[11px] text-indigo-300 font-bold">Trash & Waste Disposal</span>

                        </div>

                      </div>

                      {todayShift1 ? (

                        <div className="flex items-center gap-4 p-3.5 rounded-xl border bg-slate-950/80 border-slate-800/65">

                          <Avatar name={todayShift1} size={44} />

                          <div>

                            <div className="font-extrabold text-base text-white">{todayShift1}</div>

                            <div className="text-xs text-emerald-400 font-bold flex items-center gap-1 mt-0.5">

                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Active Duty

                            </div>

                          </div>

                        </div>

                      ) : (

                        <div className="text-slate-400 text-sm italic py-2">No members added to this rota yet</div>

                      )}

                    </div>

                  ) : (

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                      {/* Shift 1 (Lunch) */}

                      <div className="rounded-2xl p-5 border-2 transition bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60">

                        <div className="flex items-center gap-3 mb-4">

                          <span className="text-3xl">{shift1Emoji}</span>

                          <div>

                            <span className="text-xs uppercase tracking-wider text-slate-400 block font-black">{shift1Label}</span>

                            <span className="text-[11px] text-indigo-300 font-bold">{shift1Details}</span>

                          </div>

                        </div>

                        {todayShift1 ? (

                          <div className="flex items-center gap-4 p-3.5 rounded-xl border bg-slate-950/40 border-slate-750/20">

                            <Avatar name={todayShift1} size={44} />

                            <div>

                              <div className="font-extrabold text-base text-white">{todayShift1}</div>

                              <div className="text-xs text-emerald-400 font-bold flex items-center gap-1 mt-0.5">

                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Active Duty

                              </div>

                            </div>

                          </div>

                        ) : (

                          <div className="text-slate-400 text-sm italic py-2">No members added to this rota yet</div>

                        )}

                      </div>



                      {/* Shift 2 (Dinner) */}

                      <div className="rounded-2xl p-5 border-2 transition bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60">

                        <div className="flex items-center gap-3 mb-4">

                          <span className="text-3xl">{shift2Emoji}</span>

                          <div>

                            <span className="text-xs uppercase tracking-wider text-slate-400 block font-black">{shift2Label}</span>

                            <span className="text-[11px] text-indigo-300 font-bold">{shift2Details}</span>

                          </div>

                        </div>

                        {todayShift2 ? (

                          <div className="flex items-center gap-4 p-3.5 rounded-xl border bg-slate-950/40 border-slate-750/20">

                            <Avatar name={todayShift2} size={44} />

                            <div>

                              <div className="font-extrabold text-base text-white">{todayShift2}</div>

                              <div className="text-xs text-emerald-400 font-bold flex items-center gap-1 mt-0.5">

                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Active Duty

                              </div>

                            </div>

                          </div>

                        ) : (

                          <div className="text-slate-400 text-sm italic py-2">No members added to this rota yet</div>

                        )}

                      </div>

                    </div>

                  )}

                </div>

              </section>

            )}



            {/* Upcoming Timeline */}

            <section className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden">

              <div className="p-5 sm:p-6 border-b-2 border-slate-100 flex items-center justify-between">

                <div>

                  <h3 className="font-black text-slate-900 text-lg">Predictive Schedule Timeline</h3>

                  <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">Sundays Excluded • Automatic 6-day loop</p>

                </div>

                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">

                  <button

                    onClick={() => setDaysCount(7)}

                    className={`px-3.5 py-1.5 rounded-lg font-black transition ${daysCount === 7 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}

                  >

                    7 Days

                  </button>

                  <button

                    onClick={() => setDaysCount(14)}

                    className={`px-3.5 py-1.5 rounded-lg font-black transition ${daysCount === 14 ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}

                  >

                    14 Days

                  </button>

                </div>

              </div>



              <div className="divide-y divide-slate-150">

                {getUpcomingNonSundays(daysCount).map((d, index) => {

                  const [lunch, dinner] = getAssigneesForDate(currentMembersList, d, activeShiftCount);

                  const isSaturday = d.getDay() === 6;



                  return (

                    <div

                      key={index}

                      className="flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 transition hover:bg-slate-50/50 gap-4"

                    >

                      {/* Date Block */}

                      <div className="flex items-center gap-4">

                        <div className={`w-14 h-14 flex flex-col items-center justify-center rounded-2xl font-extrabold shadow-sm border-2 shrink-0 ${

                          isSaturday 

                            ? "bg-amber-50 border-amber-200 text-amber-850" 

                            : "bg-white border-slate-200 text-slate-700"

                        }`}>

                          <span className="text-[10px] uppercase tracking-wider opacity-90 leading-none">{DAYS[d.getDay()].substring(0,3)}</span>

                          <span className="text-lg font-black leading-tight mt-1">{d.getDate()}</span>

                        </div>

                        <div>

                          <div className="font-black text-slate-800 text-base">

                            {DAYS[d.getDay()], MONTHS[d.getMonth()]} {d.getDate()}

                          </div>

                          <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wide leading-none">

                            {isSaturday ? "⚡ Weekend Shift" : "🕒 Midweek Shift"}

                          </span>

                        </div>

                      </div>



                      {/* Shift Assignees Row */}

                      {activeTab === "Garbage" ? (

                        <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-100/70 py-2.5 px-4 rounded-xl border border-slate-250/50 min-w-[155px]">

                          <div className="flex items-center gap-2">

                            <span className="text-lg">🗑️</span>

                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Garbage</span>

                          </div>

                          {lunch ? (

                            <div className="flex items-center gap-2">

                              <Avatar name={lunch} size={24} />

                              <span className="text-sm font-extrabold text-slate-700">

                                {lunch}

                              </span>

                            </div>

                          ) : (

                            <span className="text-xs text-slate-400 italic font-bold">No duty</span>

                          )}

                        </div>

                      ) : (

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:flex md:items-center md:gap-4">

                          {/* Shift 1 */}

                          <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-100/70 py-2.5 px-4 rounded-xl border border-slate-250/50 min-w-[155px]">

                            <div className="flex items-center gap-2">

                              <span className="text-lg" title={shift1Label}>{shift1Emoji}</span>

                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">

                                {activeTab === "utensils" ? "Lunch" : "Morning"}

                              </span>

                            </div>

                            {lunch ? (

                              <div className="flex items-center gap-2">

                                <Avatar name={lunch} size={24} />

                                <span className="text-sm font-extrabold text-slate-700">

                                  {lunch}

                                </span>

                              </div>

                            ) : (

                              <span className="text-xs text-slate-400 italic font-bold">No duty</span>

                            )}

                          </div>



                          {/* Shift 2 */}

                          <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-100/70 py-2.5 px-4 rounded-xl border border-slate-250/50 min-w-[155px]">

                            <div className="flex items-center gap-2">

                              <span className="text-lg" title={shift2Label}>{shift2Emoji}</span>

                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">

                                {activeTab === "utensils" ? "Dinner" : "Night"}

                              </span>

                            </div>

                            {dinner ? (

                              <div className="flex items-center gap-2">

                                <Avatar name={dinner} size={24} />

                                <span className="text-sm font-extrabold text-slate-700">

                                  {dinner}

                                </span>

                              </div>

                            ) : (

                              <span className="text-xs text-slate-400 italic font-bold">No duty</span>

                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  );

                })}

              </div>

            </section>

          </div>



          {/* RIGHT: Administrative Management */}

          <div className="lg:col-span-5 xl:col-span-4 space-y-6">

            

            {/* Team Roster List */}

            <section className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm p-6 space-y-5">

              

              {/* Card Header */}

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="font-black text-slate-900 text-lg">

                    {activeTab === "utensils" ? "Kitchen Staff" : "Cleaning Crew"}

                  </h3>

                  <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">Manage Rotation Order</p>

                </div>

                

                <button

                  onClick={handleLockClick}

                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition duration-200 select-none border ${

                    unlocked

                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70"

                      : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"

                  }`}

                >

                  <LockIcon open={unlocked} className="w-4 h-4" />

                  {unlocked ? "Unlocked" : "Admin Lock"}

                </button>

              </div>



              {/* Password Challenge input (No suggestions) */}

              {showPwInput && !unlocked && (

                <div className="p-4 bg-slate-50 border-2 border-slate-250 rounded-2xl space-y-2.5 animate-fadeIn">

                  <label className="text-xs font-extrabold text-slate-600 block">

                    Admin Passcode

                  </label>

                  <div className="flex gap-2">

                    <input

                      autoFocus

                      type="password"

                      value={pwInput}

                      onChange={(e) => {

                        setPwInput(e.target.value);

                        setPwError(false);

                      }}

                      onKeyDown={(e) => e.key === "Enter" && handlePwSubmit()}

                      placeholder="••••••••"

                      className={`flex-1 bg-white border-2 ${

                        pwError ? "border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:ring-indigo-100"

                      } rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-4 transition`}

                    />

                    <button

                      onClick={handlePwSubmit}

                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition"

                    >

                      Verify

                    </button>

                  </div>

                  {pwError && (

                    <p className="text-xs font-bold text-rose-500">

                      Authentication Failed. Try again.

                    </p>

                  )}

                </div>

              )}



              {/* Members Chip List with Enlarged Elements */}

              {currentMembersList.length === 0 ? (

                <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">

                  <p className="text-sm text-slate-400 font-bold">No registered members.</p>

                </div>

              ) : (

                <div className="space-y-2.5">

                  {currentMembersList.map((m, idx) => (

                    <div

                      key={m}

                      className={`flex items-center justify-between p-3 rounded-2xl border-2 ${

                        unlocked 

                          ? "bg-white border-slate-200 transition shadow-xs" 

                          : "bg-slate-50/80 border-slate-100"

                      }`}

                    >

                      <div className="flex items-center gap-3">

                        <Avatar name={m} size={36} />

                        <span className="text-base font-extrabold text-slate-700">{m}</span>

                      </div>



                      {/* Controls */}

                      {unlocked ? (

                        <div className="flex items-center gap-1">

                          <button

                            onClick={() => moveUp(idx)}

                            disabled={idx === 0}

                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition"

                            title="Move Up"

                          >

                            <ArrowUpIcon />

                          </button>

                          <button

                            onClick={() => moveDown(idx)}

                            disabled={idx === currentMembersList.length - 1}

                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 text-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition"

                            title="Move Down"

                          >

                            <ArrowDownIcon />

                          </button>

                          <button

                            onClick={() => remove(m)}

                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-100 text-rose-600 transition ml-1"

                            title="Delete"

                          >

                            <TrashIcon />

                          </button>

                        </div>

                      ) : (

                        <span className="text-xs uppercase font-black px-2.5 py-1 bg-slate-250/50 rounded-lg text-slate-500 border border-slate-200">

                          Pos {idx + 1}

                        </span>

                      )}

                    </div>

                  ))}

                </div>

              )}



              {/* Add Input */}

              {unlocked && (

                <div className="pt-4 border-t-2 border-slate-100 space-y-2">

                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">Add New Member</span>

                  <div className="flex gap-2">

                    <input

                      type="text"

                      value={input}

                      onChange={(e) => setInput(e.target.value)}

                      onKeyDown={(e) => e.key === "Enter" && add()}

                      placeholder="e.g. Rahul Kumar"

                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition"

                    />

                    <button

                      onClick={add}

                      className={`text-white font-extrabold px-5 rounded-xl text-sm transition active:scale-95 ${

                        activeTab === "utensils" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-amber-600 hover:bg-amber-700"

                      }`}

                    >

                      Enlist

                    </button>

                  </div>

                </div>

              )}

            </section>



            {/* Look-ahead Tool */}

            <section className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm p-6 space-y-4">

              <div>

                <h3 className="font-black text-slate-900 text-base">Date Finder Lookup</h3>

                <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">Check shifts for future dates</p>

              </div>



              <div className="space-y-4">

                <input

                  type="date"

                  value={customSearchDate}

                  onChange={handleDateSearch}

                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition font-bold"

                />



                {searchResults ? (

                  searchResults.isSunday ? (

                    <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 text-center animate-fadeIn">

                      <span className="text-2xl block mb-1">☕</span>

                      <span className="text-xs font-black text-emerald-800 uppercase block">Rest Day</span>

                      <p className="text-xs text-emerald-700 font-bold mt-1">Sundays have no chores scheduled.</p>

                    </div>

                  ) : (

                    <div className="bg-indigo-50/50 rounded-2xl border-2 border-indigo-100/70 p-4 space-y-3 shadow-xs animate-fadeIn">

                      <div className="flex justify-between items-center pb-2 border-b-2 border-indigo-150/55">

                        <span className="text-xs font-black text-indigo-700 tracking-wide uppercase">Results</span>

                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">

                          {searchResults.offset > 0 ? `In ${searchResults.offset} days` : searchResults.offset < 0 ? `${Math.abs(searchResults.offset)} days ago` : "Today"}

                        </span>

                      </div>

                      <div className="space-y-2.5">

                        {activeTab === "Garbage" ? (

                          <div className="flex items-center justify-between">

                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">Garbage Duty</span>

                            {searchResults.lunch ? (

                              <div className="flex items-center gap-2">

                                <Avatar name={searchResults.lunch} size={22} />

                                <span className="text-sm font-black text-slate-700">{searchResults.lunch}</span>

                              </div>

                            ) : (

                              <span className="text-xs text-slate-400 italic">—</span>

                            )}

                          </div>

                        ) : (

                          <>

                            <div className="flex items-center justify-between">

                              <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">{shift1Label}</span>

                              {searchResults.lunch ? (

                                <div className="flex items-center gap-2">

                                  <Avatar name={searchResults.lunch} size={22} />

                                  <span className="text-sm font-black text-slate-700">{searchResults.lunch}</span>

                                </div>

                              ) : (

                                <span className="text-xs text-slate-400 italic">—</span>

                              )}

                            </div>



                            <div className="flex items-center justify-between">

                              <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">{shift2Label}</span>

                              {searchResults.dinner ? (

                                <div className="flex items-center gap-2">

                                  <Avatar name={searchResults.dinner} size={22} />

                                  <span className="text-sm font-black text-slate-700">{searchResults.dinner}</span>

                                </div>

                              ) : (

                                <span className="text-xs text-slate-400 italic">—</span>

                              )}

                            </div>

                          </>

                        )}

                      </div>

                    </div>

                  )

                ) : (

                  <p className="text-xs text-slate-400 font-bold text-center py-3 border-2 border-dashed border-slate-100 rounded-2xl">

                    Verify who is scheduled on any calendar day.

                  </p>

                )}

              </div>

            </section>



          </div>



        </div>



      </div>

    </div>

  );

}