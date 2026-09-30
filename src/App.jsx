import React, { useEffect, useState } from "react";

// Days and Months constants
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ADMIN_SECRET = "kitchen123";

// Shared flatmates list
const DEFAULT_MEMBERS = ["Aman", "Subhram", "Chinmaya", "Pritam"];

// Member verification PIN codes (Kept private in code/server, not displayed on UI)
const MEMBER_PASSCODES = {
  Aman: "1001",
  Subhram: "1002",
  Chinmaya: "1003",
  Pritam: "1004",
};

const ROTA_API_URL = "/api/rota";
const DEVICE_USER_STORAGE_KEY = "household-rota:device-verified-member";

// 12 working-day cycle matrix starting Wednesday, Sep 30, 2026
// Member indices: 0: Aman, 1: Subhram, 2: Chinmaya, 3: Pritam
const TWO_WEEK_UTENSILS_CYCLE = [
  [1, 0], // Day 0 (Wed, Sep 30): Subhram, Aman
  [3, 2], // Day 1 (Thu, Oct 1):  Pritam, Chinmaya
  [0, 1], // Day 2 (Fri, Oct 2):  Aman, Subhram
  [2, 3], // Day 3 (Sat, Oct 3):  Chinmaya, Pritam
  // Sunday skipped
  [1, 0], // Day 4 (Mon, Oct 5):  Subhram, Aman
  [3, 2], // Day 5 (Tue, Oct 6):  Pritam, Chinmaya
  [0, 1], // Day 6 (Wed, Oct 7):  Aman, Subhram
  [2, 3], // Day 7 (Thu, Oct 8):  Chinmaya, Pritam
  [1, 0], // Day 8 (Fri, Oct 9):  Subhram, Aman
  [3, 2], // Day 9 (Sat, Oct 10): Pritam, Chinmaya
  // Sunday skipped
  [0, 1], // Day 10 (Mon, Oct 12): Aman, Subhram
  [2, 3], // Day 11 (Tue, Oct 13): Chinmaya, Pritam
];

// DST-safe offset date generation
function getDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

// Anchored directly to Wednesday, Sep 30, 2026
function nonSundayIndexFromBase(targetDate) {
  const base = new Date(2026, 8, 30, 12, 0, 0);
  const target = new Date(targetDate);
  target.setHours(12, 0, 0, 0);

  const diffDays = Math.round((target - base) / 86400000);
  if (diffDays === 0) return 0;

  let workingDays = 0;
  const step = diffDays > 0 ? 1 : -1;
  const cur = new Date(base);

  while (Math.round((target - cur) / 86400000) !== 0) {
    cur.setDate(cur.getDate() + step);
    if (cur.getDay() !== 0) {
      workingDays += step;
    }
  }

  return ((workingDays % 12) + 12) % 12;
}

// Utensils rotation engine skipping Sundays
function getUtensilsForDate(members, targetDate) {
  const safeMembers = Array.isArray(members) && members.length ? members : DEFAULT_MEMBERS;
  if (targetDate.getDay() === 0) return [null, null];

  const rotationIndex = nonSundayIndexFromBase(targetDate);

  if (safeMembers.length === 4) {
    const [lunchIdx, dinnerIdx] = TWO_WEEK_UTENSILS_CYCLE[rotationIndex % 12];
    return [safeMembers[lunchIdx], safeMembers[dinnerIdx]];
  }

  return [
    safeMembers[rotationIndex % safeMembers.length],
    safeMembers[(rotationIndex + 1) % safeMembers.length],
  ];
}

function normalizeMembersList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((member) => typeof member === "string" && member.trim().length > 0);
  return cleaned.length >= 2 ? cleaned : fallback;
}

function avatarColor(name = "") {
  const str = String(name || "?");
  const gradients = [
    "linear-gradient(135deg, #6366f1, #4f46e5)",
    "linear-gradient(135deg, #0ea5e9, #0284c7)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #ef4444, #dc2626)",
    "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    "linear-gradient(135deg, #ec4899, #db2777)",
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % gradients.length;
  }
  return gradients[h];
}

function Avatar({ name = "", size = 36 }) {
  const initial = name && typeof name === "string" && name.trim().length > 0 ? name.trim()[0].toUpperCase() : "?";

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
      {initial}
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
  const [activeTab, setActiveTab] = useState("utensils");

  const [utensilsMembers, setUtensilsMembers] = useState(DEFAULT_MEMBERS);
  const [GarbageMembers, setGarbageMembers] = useState(DEFAULT_MEMBERS);

  // Phone identity verified via one-time code (stays on device)
  const [verifiedMember, setVerifiedMember] = useState(() => {
    return localStorage.getItem(DEVICE_USER_STORAGE_KEY) || null;
  });

  const [verifyPinInput, setVerifyPinInput] = useState("");
  const [verifyPinError, setVerifyPinError] = useState("");

  // Shared Garbage Cycle state (synced with data/rota.json)
  const [garbageCycle, setGarbageCycle] = useState({
    currentIndex: 0,
    approvals: {},
    history: [],
  });

  const [proxyTargetMember, setProxyTargetMember] = useState(null);

  // History Clear Modal
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [clearHistoryPassword, setClearHistoryPassword] = useState("");
  const [clearHistoryError, setClearHistoryError] = useState(false);

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

  const currentMembersList =
    (activeTab === "utensils" ? utensilsMembers : GarbageMembers)?.length > 0
      ? activeTab === "utensils"
        ? utensilsMembers
        : GarbageMembers
      : DEFAULT_MEMBERS;

  const todayDateObj = getDate(0);
  const isTodaySunday = todayDateObj.getDay() === 0;

  const safeGarbageMembers = GarbageMembers.length ? GarbageMembers : DEFAULT_MEMBERS;
  const currentGarbageAssignee = safeGarbageMembers[garbageCycle.currentIndex % safeGarbageMembers.length];
  const requiredApprovers = safeGarbageMembers.filter((m) => m !== currentGarbageAssignee);

  const getApprovalStatus = (memberName) => {
    const record = garbageCycle.approvals[memberName];
    if (!record) return null;
    return typeof record === "string" ? { status: record, approvedBy: memberName, isProxy: false } : record;
  };

  const approvedCount = requiredApprovers.filter((m) => getApprovalStatus(m)?.status === "approved").length;

  // Sync state with data/rota.json via /api/rota
  const syncWithServer = async () => {
    try {
      const response = await fetch(ROTA_API_URL);
      if (!response.ok) return;
      const data = await response.json();

      if (data?.members?.utensils) {
        setUtensilsMembers(normalizeMembersList(data.members.utensils, DEFAULT_MEMBERS));
      }
      if (data?.members?.garbage) {
        setGarbageMembers(normalizeMembersList(data.members.garbage, DEFAULT_MEMBERS));
      }
      if (data?.garbageCycle) {
        setGarbageCycle(data.garbageCycle);
      }
    } catch (err) {
      console.warn("Could not sync with /api/rota", err);
    }
  };

  // Initial load and periodic 4-second poll for cross-phone synchronization
  useEffect(() => {
    syncWithServer();
    const interval = setInterval(syncWithServer, 4000);
    return () => clearInterval(interval);
  }, []);

  // Save changes back to data/rota.json via /api/rota
  const patchServerData = async (payload) => {
    try {
      await fetch(ROTA_API_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to patch /api/rota", err);
    }
  };

  const handleVerifyPhone = (e) => {
    e.preventDefault();
    const pin = verifyPinInput.trim();
    if (!pin) return;

    const foundMember = Object.keys(MEMBER_PASSCODES).find(
      (name) => MEMBER_PASSCODES[name] === pin
    );

    if (foundMember) {
      setVerifiedMember(foundMember);
      localStorage.setItem(DEVICE_USER_STORAGE_KEY, foundMember);
      setVerifyPinInput("");
      setVerifyPinError("");
    } else {
      setVerifyPinError("Invalid PIN. Please check with your household admin.");
    }
  };

  const handleLogoutDevice = () => {
    localStorage.removeItem(DEVICE_USER_STORAGE_KEY);
    setVerifiedMember(null);
  };

  const updateGarbageCycle = (newCycleState) => {
    setGarbageCycle(newCycleState);
    patchServerData({ garbageCycle: newCycleState });
  };

  const submitDecisionForMember = (targetMember, decision, isProxy = false) => {
    if (!verifiedMember) return;

    const newApprovalRecord = {
      status: decision,
      approvedBy: verifiedMember,
      isProxy: isProxy,
    };

    const newApprovals = {
      ...garbageCycle.approvals,
      [targetMember]: newApprovalRecord,
    };

    const totalApproved = requiredApprovers.filter((m) => {
      const rec = m === targetMember ? newApprovalRecord : getApprovalStatus(m);
      return rec?.status === "approved";
    }).length;

    if (totalApproved === requiredApprovers.length) {
      const nextIdx = (garbageCycle.currentIndex + 1) % safeGarbageMembers.length;
      const now = new Date();

      const proxyRecords = [];
      requiredApprovers.forEach((m) => {
        const rec = m === targetMember ? newApprovalRecord : getApprovalStatus(m);
        if (rec?.isProxy) {
          proxyRecords.push({ forMember: m, approvedBy: rec.approvedBy });
        }
      });

      const historyEntry = {
        id: Date.now(),
        cleaner: currentGarbageAssignee,
        dateStr: `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
        timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        proxies: proxyRecords,
        epoch: now.getTime(),
      };

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const filteredHistory = [historyEntry, ...(garbageCycle.history || [])].filter(
        (item) => !item.epoch || item.epoch >= thirtyDaysAgo
      );

      const updatedCycle = {
        currentIndex: nextIdx,
        approvals: {},
        history: filteredHistory,
      };
      updateGarbageCycle(updatedCycle);
    } else {
      updateGarbageCycle({
        ...garbageCycle,
        approvals: newApprovals,
      });
    }
  };

  const handleClearHistorySubmit = (e) => {
    e.preventDefault();
    if (clearHistoryPassword === ADMIN_SECRET) {
      const updatedCycle = {
        ...garbageCycle,
        history: [],
      };
      updateGarbageCycle(updatedCycle);
      setShowClearHistoryModal(false);
      setClearHistoryPassword("");
      setClearHistoryError(false);
    } else {
      setClearHistoryError(true);
      setClearHistoryPassword("");
    }
  };

  const manualAdvanceGarbage = () => {
    const nextIdx = (garbageCycle.currentIndex + 1) % safeGarbageMembers.length;
    updateGarbageCycle({
      ...garbageCycle,
      currentIndex: nextIdx,
      approvals: {},
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

  const saveMembersList = (newUtensils, newGarbage) => {
    patchServerData({
      members: {
        utensils: newUtensils,
        garbage: newGarbage,
      },
    });
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
      const updated = [...utensilsMembers, name];
      setUtensilsMembers(updated);
      saveMembersList(updated, GarbageMembers);
    } else {
      const updated = [...GarbageMembers, name];
      setGarbageMembers(updated);
      saveMembersList(utensilsMembers, updated);
    }
    setInput("");
  };

  const remove = (name) => {
    if (currentMembersList.length <= 2) {
      setErrorNotification("Cannot delete. At least 2 members are required.");
      return;
    }
    if (activeTab === "utensils") {
      const updated = utensilsMembers.filter((m) => m !== name);
      setUtensilsMembers(updated);
      saveMembersList(updated, GarbageMembers);
    } else {
      const updated = GarbageMembers.filter((m) => m !== name);
      setGarbageMembers(updated);
      saveMembersList(utensilsMembers, updated);
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
      saveMembersList(list, GarbageMembers);
    } else {
      setGarbageMembers(list);
      saveMembersList(utensilsMembers, list);
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
      saveMembersList(list, GarbageMembers);
    } else {
      setGarbageMembers(list);
      saveMembersList(utensilsMembers, list);
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
    if (pwInput === ADMIN_SECRET) {
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

      navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      const lines = [
        `🗑 Garbage Clearance Status`,
        `Current Cleaner: ${currentGarbageAssignee}`,
        `Approvals: ${approvedCount}/${requiredApprovers.length}`,
        ...requiredApprovers.map((m) => {
          const rec = getApprovalStatus(m);
          return `• ${m}: ${
            rec?.status === "approved"
              ? rec.isProxy
                ? `Approved by ${rec.approvedBy}`
                : "Approved"
              : rec?.status === "declined"
              ? "Declined"
              : "Pending"
          }`;
        }),
      ];

      navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [todayLunch, todayDinner] = getUtensilsForDate(currentMembersList, todayDateObj);
  const upcomingDays = getUpcomingNonSundays(daysCount);
  const currentUserDecision = verifiedMember ? getApprovalStatus(verifiedMember) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-3 sm:p-6 md:py-10">
      {/* ONE-TIME PHONE VERIFICATION MODAL (NO CODES DISPLAYED) */}
      {!verifiedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-5 border-2 border-slate-100">
            <div className="text-center space-y-1">
              <span className="text-4xl block">📱</span>
              <h2 className="text-2xl font-black text-slate-800">Verify Your Phone</h2>
              <p className="text-xs text-slate-500">
                Enter your private 4-digit household PIN. Your device will stay verified.
              </p>
            </div>

            <form onSubmit={handleVerifyPhone} className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={verifyPinInput}
                  onChange={(e) => {
                    setVerifyPinInput(e.target.value);
                    setVerifyPinError("");
                  }}
                  className="w-full text-center tracking-widest text-3xl font-black py-3 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-hidden bg-slate-50"
                  autoFocus
                />
                {verifyPinError && (
                  <p className="text-xs font-bold text-rose-600 text-center mt-2 leading-tight">
                    {verifyPinError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition text-white font-black rounded-2xl shadow-md text-sm"
              >
                Verify Device
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DOUBLE CONFIRMATION MODAL FOR PROXY APPROVAL */}
      {proxyTargetMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 border-2 border-amber-200">
            <div className="text-center space-y-2">
              <span className="text-4xl block">🤝</span>
              <h3 className="text-lg font-black text-slate-800">
                Confirm Proxy Approval
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to approve for <strong className="text-indigo-600">{proxyTargetMember}</strong> because they are absent?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 font-semibold">
                ⚠️ Your name (<strong className="font-black text-slate-900">{verifiedMember}</strong>) will be stamped in history as the proxy approver.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProxyTargetMember(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  submitDecisionForMember(proxyTargetMember, "approved", true);
                  setProxyTargetMember(null);
                }}
                className="w-1/2 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition"
              >
                Yes, Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD-PROTECTED CLEAR HISTORY MODAL */}
      {showClearHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 border-2 border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔒</span>
                <h3 className="text-lg font-black text-slate-800">Clear History</h3>
              </div>
              <button
                onClick={() => {
                  setShowClearHistoryModal(false);
                  setClearHistoryPassword("");
                  setClearHistoryError(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter admin password to wipe the past 1-month garbage log.
            </p>

            <form onSubmit={handleClearHistorySubmit} className="space-y-3">
              <div>
                <input
                  type="password"
                  placeholder="Enter password..."
                  value={clearHistoryPassword}
                  onChange={(e) => {
                    setClearHistoryPassword(e.target.value);
                    setClearHistoryError(false);
                  }}
                  className="w-full text-center text-sm font-bold py-2.5 rounded-xl border-2 border-slate-200 focus:border-rose-600 focus:outline-hidden bg-slate-50"
                  autoFocus
                />
                {clearHistoryError && (
                  <p className="text-xs font-bold text-rose-600 text-center mt-1.5">
                    Incorrect password.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearHistoryModal(false);
                    setClearHistoryPassword("");
                    setClearHistoryError(false);
                  }}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                >
                  Wipe History
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="w-full max-w-5xl space-y-5">
        {/* Error Notification Banner */}
        {errorNotification && (
          <div className="bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <p className="font-bold text-sm">{errorNotification}</p>
            </div>
            <button
              onClick={() => setErrorNotification("")}
              className="text-rose-500 font-extrabold text-lg px-1 hover:bg-rose-100 rounded-lg"
            >
              ✕
            </button>
          </div>
        )}

        {/* Task Menu Header */}
        <nav className="grid grid-cols-2 p-1.5 bg-slate-200/70 border-2 border-slate-300/40 rounded-2xl gap-2">
          <button
            onClick={() => {
              setActiveTab("utensils");
              setSearchResults(null);
              setCustomSearchDate("");
            }}
            className={`flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-xl font-black text-sm sm:text-base transition duration-200 active:scale-95 ${
              activeTab === "utensils"
                ? "bg-indigo-600 text-white shadow-md border-b-4 border-indigo-800"
                : "text-slate-600 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            <span className="text-lg">🍜</span>
            <span>Utensils</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("Garbage");
              setSearchResults(null);
              setCustomSearchDate("");
            }}
            className={`flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-xl font-black text-sm sm:text-base transition duration-200 active:scale-95 ${
              activeTab === "Garbage"
                ? "bg-amber-600 text-white shadow-md border-b-4 border-amber-800"
                : "text-slate-600 hover:bg-slate-300 hover:text-slate-900"
            }`}
          >
            <span className="text-lg">🗑️️</span>
            <span>Garbage</span>
          </button>
        </nav>

        {/* Sub-Header & Device Badge */}
        <header className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-extrabold tracking-wider uppercase ${
                activeTab === "utensils"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              <span>{activeTab === "utensils" ? "🍽️" : "🗑️"}</span>
              <span>{activeTab === "utensils" ? "Utensils 2-Week Cycle" : "Garbage Approval"}</span>
            </span>

            {verifiedMember && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Verified: <strong className="text-slate-800">{verifiedMember}</strong>
                <button
                  onClick={handleLogoutDevice}
                  className="text-[10px] text-indigo-600 underline ml-1 hover:text-indigo-800"
                >
                  Change
                </button>
              </span>
            )}
          </div>

          <button
            onClick={copyRotaText}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 transition text-slate-800 font-bold px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-xs"
          >
            {copied ? <span className="text-emerald-600 font-black">✓ Copied</span> : <span>Share Rota</span>}
          </button>
        </header>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: Main Active Section */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-5">
            {activeTab === "utensils" ? (
              <>
                {/* Utensils View */}
                {isTodaySunday ? (
                  <section className="bg-gradient-to-r from-emerald-950 to-teal-900 text-white rounded-3xl p-6 shadow-md">
                    <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-300">
                      WEEKEND STATUS
                    </span>
                    <h2 className="text-2xl font-black mt-1">Today is Sunday</h2>
                    <p className="text-emerald-200 text-sm mt-2">☕ Rest Day — No utensils chore scheduled.</p>
                  </section>
                ) : (
                  <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
                    <div className="border-b pb-3 mb-4 border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-black text-indigo-600">
                          TODAY'S ROTATION
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                          {DAYS[todayDateObj.getDay()]}, {todayDateObj.getDate()} {MONTHS[todayDateObj.getMonth()]}
                        </h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                        <Avatar name={todayLunch} size={44} />
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                            Lunch Duty
                          </span>
                          <h4 className="text-lg font-black text-slate-800">{todayLunch || "None"}</h4>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3">
                        <Avatar name={todayDinner} size={44} />
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                            Dinner Duty
                          </span>
                          <h4 className="text-lg font-black text-slate-800">{todayDinner || "None"}</h4>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Upcoming Utensils Table */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base sm:text-lg font-black text-slate-800">Upcoming Schedule</h3>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setDaysCount(6)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          daysCount === 6 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        6d
                      </button>
                      <button
                        onClick={() => setDaysCount(12)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          daysCount === 12 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        12d
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-black uppercase text-slate-400">
                          <th className="py-2.5 px-2">Day</th>
                          <th className="py-2.5 px-2">Lunch</th>
                          <th className="py-2.5 px-2">Dinner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                        {upcomingDays.map((d, i) => {
                          const [lunch, dinner] = getUtensilsForDate(currentMembersList, d);
                          return (
                            <tr key={i} className="hover:bg-slate-50 transition">
                              <td className="py-2.5 px-2 font-bold text-slate-700">
                                {DAYS[d.getDay()]}, {d.getDate()} {MONTHS[d.getMonth()]}
                              </td>
                              <td className="py-2.5 px-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <Avatar name={lunch} size={22} />
                                  {lunch}
                                </span>
                              </td>
                              <td className="py-2.5 px-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <Avatar name={dinner} size={22} />
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
              <div className="space-y-5">
                {/* Active Assignee Banner */}
                <section className="bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-3xl p-5 sm:p-7 shadow-md">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-black text-amber-200">
                        GARBAGE DUTY
                      </span>
                      <h2 className="text-2xl font-black">Clean When Full</h2>
                    </div>
                    <span className="bg-amber-900/60 border border-amber-300/30 text-amber-100 px-3 py-1 rounded-xl text-xs font-black">
                      {approvedCount} of {requiredApprovers.length} Approvals
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={currentGarbageAssignee} size={50} />
                      <div>
                        <span className="text-[10px] font-black text-amber-200 uppercase tracking-wider block">
                          Assigned To Empty Bin
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black">{currentGarbageAssignee}</h3>
                      </div>
                    </div>

                    <button
                      onClick={manualAdvanceGarbage}
                      className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl border border-white/20 transition"
                      title="Skip turn"
                    >
                      Skip ➔
                    </button>
                  </div>
                </section>

                {/* Direct Action Card for Verified Phone User */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
                        Action on your phone
                      </span>
                      <h3 className="text-lg font-black text-slate-800">
                        Did {currentGarbageAssignee} clean the garbage?
                      </h3>
                    </div>
                    {verifiedMember && (
                      <span className="text-xs font-extrabold text-slate-400">
                        You: <strong className="text-slate-700">{verifiedMember}</strong>
                      </span>
                    )}
                  </div>

                  {verifiedMember === currentGarbageAssignee ? (
                    <div className="bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-2xl p-4 text-center space-y-1">
                      <span className="text-2xl block">🧹</span>
                      <h4 className="font-black text-base">It's your turn to clean the bin!</h4>
                      <p className="text-xs text-amber-700">
                        Once you dispose of the garbage, your flatmates ({requiredApprovers.join(", ")}) will approve it on their phones.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => submitDecisionForMember(verifiedMember, "approved", false)}
                          className={`py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition active:scale-95 ${
                            currentUserDecision?.status === "approved"
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/50"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          <span className="text-lg">✓</span>
                          <span>Approve</span>
                        </button>

                        <button
                          onClick={() => submitDecisionForMember(verifiedMember, "declined", false)}
                          className={`py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition active:scale-95 ${
                            currentUserDecision?.status === "declined"
                              ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500/50"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
                          }`}
                        >
                          <span className="text-lg">✕</span>
                          <span>Decline</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-center text-slate-400">
                        Your vote is saved. When all 3 roommates approve, the roster passes to the next person.
                      </p>
                    </div>
                  )}
                </section>

                {/* Consensus Overview + Proxy Option */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                    <h3 className="text-sm font-black text-slate-800">Flatmates Approval Status</h3>
                    <span className="text-[10px] text-slate-400">Tap below to approve for absent housemates</span>
                  </div>

                  <div className="space-y-2.5">
                    {requiredApprovers.map((member) => {
                      const rec = getApprovalStatus(member);
                      const isSelf = member === verifiedMember;

                      return (
                        <div
                          key={member}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl border transition gap-2 ${
                            rec?.status === "approved"
                              ? "bg-emerald-50/70 border-emerald-300"
                              : rec?.status === "declined"
                              ? "bg-rose-50/70 border-rose-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar name={member} size={32} />
                            <div>
                              <span className="font-extrabold text-sm text-slate-800 block">
                                {member} {isSelf && <span className="text-[10px] text-indigo-600 font-bold">(You)</span>}
                              </span>
                              {rec?.isProxy && (
                                <span className="text-[10px] text-indigo-700 font-semibold block">
                                  Approved on behalf by {rec.approvedBy}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span
                              className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                                rec?.status === "approved"
                                  ? "bg-emerald-600 text-white"
                                  : rec?.status === "declined"
                                  ? "bg-rose-600 text-white"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {rec?.status === "approved"
                                ? rec.isProxy
                                  ? `Approved ✓ (${rec.approvedBy})`
                                  : "Approved ✓"
                                : rec?.status === "declined"
                                ? "Declined ✕"
                                : "Pending ⏳"}
                            </span>

                            {!isSelf && rec?.status !== "approved" && (
                              <button
                                onClick={() => setProxyTargetMember(member)}
                                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition"
                                title={`Approve for ${member} if they are absent`}
                              >
                                Approve for {member}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* 1-Month Garbage History Log with Proxy Attribution */}
                <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-800">1-Month Cleaning History</h3>
                      <span className="text-[10px] text-slate-400 font-bold">(30 Days)</span>
                    </div>

                    {garbageCycle.history && garbageCycle.history.length > 0 && (
                      <button
                        onClick={() => setShowClearHistoryModal(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition"
                      >
                        <span>🔒</span> Clear Log
                      </button>
                    )}
                  </div>

                  {garbageCycle.history && garbageCycle.history.length > 0 ? (
                    <div className="divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto pr-1">
                      {garbageCycle.history.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={item.cleaner} size={28} />
                            <div>
                              <span className="font-black text-slate-800 block">Cleaned by {item.cleaner}</span>
                              <span className="text-[10px] text-slate-400">{item.dateStr}</span>
                              {item.proxies && item.proxies.length > 0 && (
                                <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                  {item.proxies.map((p, idx) => (
                                    <span key={idx} className="block">
                                      Proxy for {p.forMember}: approved by {p.approvedBy}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            Approved ({item.timestamp})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No cleans recorded in the last 30 days.
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>

          {/* RIGHT: Calendar Lookup & Settings */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {activeTab === "utensils" ? (
              <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-xs">
                <h3 className="text-base font-black text-slate-800 mb-1">Check Utensils Date</h3>
                <p className="text-xs text-slate-500 mb-3">Lookup who is assigned for lunch and dinner on any day.</p>

                <input
                  type="date"
                  value={customSearchDate}
                  onChange={handleDateSearch}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-sm text-slate-700"
                />

                {searchResults && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {DAYS[searchResults.date.getDay()]}, {searchResults.date.getDate()} {MONTHS[searchResults.date.getMonth()]}
                    </div>

                    {searchResults.isSunday ? (
                      <div className="text-emerald-600 font-extrabold text-sm">Sunday — No Chores</div>
                    ) : (
                      <>
                        <div>
                          <span className="font-bold text-slate-500">Lunch: </span>
                          <span className="font-black text-slate-800">{searchResults.lunch}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500">Dinner: </span>
                          <span className="font-black text-slate-800">{searchResults.dinner}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <h3 className="text-base font-black text-slate-800">Rotation Queue</h3>
                <div className="space-y-1.5">
                  {safeGarbageMembers.map((member, i) => {
                    const isCurrent = i === garbageCycle.currentIndex % safeGarbageMembers.length;
                    return (
                      <div
                        key={member}
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          isCurrent
                            ? "bg-amber-50 border-amber-300 font-black"
                            : "bg-slate-50 border-slate-200 opacity-70"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar name={member} size={26} />
                          <span className="text-xs font-bold text-slate-800">{member}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          {isCurrent
                            ? "Current Turn"
                            : `Next #${((i - garbageCycle.currentIndex + safeGarbageMembers.length) % safeGarbageMembers.length) + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Member Management Roster */}
            <section className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Household Members</h3>
                  <span className="text-[10px] text-slate-400">Locked roster order</span>
                </div>
                <button
                  onClick={handleLockClick}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 border border-slate-200"
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
                    className="w-full text-xs border rounded-xl p-2 font-medium"
                  />
                  {pwError && <p className="text-[10px] text-rose-600 font-bold">Incorrect password.</p>}
                  <button
                    onClick={handlePwSubmit}
                    className="w-full bg-slate-800 text-white rounded-xl py-1.5 font-bold text-xs"
                  >
                    Unlock
                  </button>
                </div>
              )}

              <ul className="space-y-1.5">
                {currentMembersList.map((member, index) => (
                  <li
                    key={member}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={member} size={26} />
                      <span className="font-extrabold text-xs text-slate-700">{member}</span>
                    </div>

                    {unlocked && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-slate-500 disabled:opacity-30"
                        >
                          <ArrowUpIcon />
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === currentMembersList.length - 1}
                          className="p-1 text-slate-500 disabled:opacity-30"
                        >
                          <ArrowDownIcon />
                        </button>
                        <button onClick={() => remove(member)} className="p-1 text-rose-600">
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {unlocked && (
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Add member..."
                    className="w-full text-xs border rounded-xl px-2.5 py-1.5 font-medium"
                  />
                  <button onClick={add} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">
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
