import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Trash2, ChevronDown, ChevronUp, Dumbbell, History, Flame } from "lucide-react";

// Custom "Trends" icon — an axis + zigzag trend line with a solid arrowhead,
// drawn from scratch to match the composition style the user wants (not a
// copy of any specific app's artwork) so it fits our brass/gold design system.
function TrendsIcon({ size = 18, color = "#8E8E8E", strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* axis */}
      <path d="M3 3 L3 21 L21 21" />
      {/* zigzag trend line */}
      <path d="M4.5 16.5 L9.5 12 L13 15 L19.5 6.5" />
      {/* open chevron arrowhead */}
      <path d="M14.5 6.5 L20 6 L19.5 11.5" />
    </svg>
  );
}

// ---------- Exercise library ----------
const EXERCISE_LIBRARY = {
  Chest: ["Bench Press", "Incline Bench Press", "Dumbbell Press", "Chest Fly", "Push-Up", "Dips"],
  Back: ["Deadlift", "Pull-Up", "Lat Pulldown", "Barbell Row", "Seated Cable Row", "Face Pull"],
  Legs: ["Squat", "Leg Press", "Lunges", "Leg Extension", "Leg Curl", "Calf Raise"],
  Shoulders: ["Overhead Press", "Lateral Raise", "Front Raise", "Rear Delt Fly", "Shrugs"],
  Arms: ["Bicep Curl", "Hammer Curl", "Tricep Pushdown", "Skull Crusher", "Preacher Curl"],
  Core: ["Plank", "Crunch", "Hanging Leg Raise", "Cable Crunch", "Russian Twist"],
};
const MUSCLE_GROUPS = Object.keys(EXERCISE_LIBRARY);

// ---------- Wheel picker ----------
const WHEEL_ITEM_H = 48;
const WHEEL_VISIBLE = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_H * WHEEL_VISIBLE;
const WHEEL_PAD = (WHEEL_HEIGHT - WHEEL_ITEM_H) / 2;

let audioCtx = null;
function getAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playTickSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Body: very short resonant "wood block" thump, quick pitch drop, minimal ring
    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(310, now);
    body.frequency.exponentialRampToValueAtTime(180, now + 0.012);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.32, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);
    body.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.014);

    // Click: tight bandpassed noise transient around 3-4kHz, very short decay
    const bufferSize = Math.floor(ctx.sampleRate * 0.01);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 3400;
    filter.Q.value = 2.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.01);
  } catch (e) {
    // Web Audio unsupported — fail silently
  }
}

function vibrateTick() {
  playTickSound();
  try {
    if (navigator.vibrate) navigator.vibrate(3);
  } catch (e) {
    // Vibration API unsupported (e.g. iOS Safari) — fail silently
  }
}

function WheelPicker({ options, index, onChange }) {
  const scrollRef = useRef(null);
  const timeoutRef = useRef(null);
  const isProgrammatic = useRef(false);
  const lastTickIndex = useRef(index);
  const rafRef = useRef(null);
  const [liveIndex, setLiveIndex] = useState(index); // continuous fractional position, follows finger 1:1

  useEffect(() => {
    if (scrollRef.current) {
      isProgrammatic.current = true;
      scrollRef.current.scrollTop = index * WHEEL_ITEM_H;
      lastTickIndex.current = index;
      setLiveIndex(index);
      setTimeout(() => (isProgrammatic.current = false), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const handleScroll = () => {
    if (isProgrammatic.current) return;
    const el = scrollRef.current;
    if (!el) return;

    // Hard-clamp scrollTop so it's never possible to drag past the first
    // or last item.
    const maxScroll = (options.length - 1) * WHEEL_ITEM_H;
    if (el.scrollTop < 0) el.scrollTop = 0;
    else if (el.scrollTop > maxScroll) el.scrollTop = maxScroll;

    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (scrollRef.current) setLiveIndex(scrollRef.current.scrollTop / WHEEL_ITEM_H);
      });
    }

    const live = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_H)));
    if (live !== lastTickIndex.current) {
      lastTickIndex.current = live;
      vibrateTick();
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const i = Math.round(el.scrollTop / WHEEL_ITEM_H);
      const clamped = Math.max(0, Math.min(options.length - 1, i));
      el.scrollTo({ top: clamped * WHEEL_ITEM_H, behavior: "smooth" });
      onChange(clamped);
      setLiveIndex(clamped);
    }, 120);
  };

  return (
    <div style={wheelStyles.wrap}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          ...wheelStyles.scroller,
          paddingTop: WHEEL_PAD,
          paddingBottom: WHEEL_PAD,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {options.map((opt, i) => {
          const dist = Math.min(2, Math.abs(i - liveIndex));
          const scale = 1.15 - dist * 0.175;
          const opacity = 1 - dist * 0.36;
          const selected = Math.round(liveIndex) === i;
          return (
            <div
              key={opt}
              style={{
                ...wheelStyles.item,
                color: selected ? "#ECE9E2" : "#8E8E8E",
                transform: `scale(${scale})`,
                opacity,
              }}
            >
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const wheelStyles = {
  pickerRow: { display: "flex", gap: 10, position: "relative" },
  wrap: {
    position: "relative",
    height: WHEEL_HEIGHT,
    flex: 1,
    overflow: "hidden",
    touchAction: "pan-y",
    overscrollBehavior: "none",
    zIndex: 1,
  },
  scroller: {
    height: "100%",
    overflowY: "scroll",
    overflowX: "hidden",
    touchAction: "pan-y",
    overscrollBehavior: "none",
    scrollSnapType: "y mandatory",
  },
  item: {
    height: WHEEL_ITEM_H,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 19,
    scrollSnapAlign: "center",
    textAlign: "center",
    padding: "0 8px",
    transition: "color 0.08s linear",
  },
};

// ---------- Storage helpers ----------
// Uses the browser's own localStorage — this is what makes data persist on
// your phone permanently once the app is hosted for real (unlike the
// chat-preview storage, this works on any website, forever, per-device).
const WORKOUTS_KEY = "workouts";

async function loadWorkouts() {
  try {
    const raw = window.localStorage.getItem(WORKOUTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function saveWorkouts(workouts) {
  try {
    window.localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
  } catch (e) {
    console.error("Storage save failed", e);
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayStr = todayISO();
  if (iso === todayStr) return "Today";
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(
    yest.getDate()
  ).padStart(2, "0")}`;
  if (iso === yestStr) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function volumeOf(exercise) {
  return exercise.sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
}

// ---------- Plate bar (signature element) ----------
// Represents each logged set as a segment, filled proportionally to weight vs the exercise's max.
function LoadBar({ sets }) {
  const max = Math.max(1, ...sets.map((s) => Number(s.weight) || 0));
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 22 }}>
      {sets.map((s, i) => {
        const w = Number(s.weight) || 0;
        const h = Math.max(6, Math.round((w / max) * 22));
        return (
          <div
            key={i}
            title={`${w} × ${s.reps}`}
            style={{
              width: 7,
              height: h,
              background: "linear-gradient(180deg, #C7A15A, #9C7A3E)",
              borderRadius: 1.5,
              flexShrink: 0,
            }}
          />
        );
      })}
      {sets.length === 0 && (
        <div style={{ fontSize: 11, color: "#6E6E6E", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" }}>no sets yet</div>
      )}
    </div>
  );
}

// ---------- Main App ----------
const VIEWS = ["today", "history", "progress"];

export default function WorkoutLogger() {
  const [workouts, setWorkouts] = useState(null); // null = loading
  const [view, setView] = useState("today"); // today | history | progress
  const viewIndex = VIEWS.indexOf(view);
  const [expanded, setExpanded] = useState({}); // exerciseId -> bool
  const [addingExercise, setAddingExercise] = useState(false);
  const [groupIdx, setGroupIdx] = useState(0);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const nameInputRef = useRef(null);
  const viewportRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(null); // px offset while actively dragging, null when not
  const dragInfo = useRef({ startX: 0, startY: 0, baseOffset: 0, width: 0, locked: null });
  const [importPending, setImportPending] = useState(null); // parsed data awaiting confirmation, or null
  const [importError, setImportError] = useState(null); // error message string, or null

  const currentGroup = MUSCLE_GROUPS[groupIdx];
  const currentExerciseList = EXERCISE_LIBRARY[currentGroup];
  const currentExerciseName = currentExerciseList[Math.min(exerciseIdx, currentExerciseList.length - 1)];

  useEffect(() => {
    loadWorkouts().then((w) => setWorkouts(w));
  }, []);

  const persist = useCallback((next) => {
    setWorkouts(next);
    saveWorkouts(next);
  }, []);

  useEffect(() => {
    if (addingExercise && nameInputRef.current) nameInputRef.current.focus();
  }, [addingExercise]);

  const handleTouchStart = (e) => {
    if (addingExercise) return; // don't intercept swipes while the sheet is open
    const width = viewportRef.current ? viewportRef.current.offsetWidth : 0;
    dragInfo.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      baseOffset: -viewIndex * width,
      width,
      locked: null,
    };
  };

  // React attaches onTouchMove as a passive listener, which silently blocks
  // preventDefault() from working — so the swipe logic would run but could
  // never actually stop the page's native vertical scroll from fighting it.
  // A manually-attached listener with { passive: false } fixes that.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (addingExercise) return;
      const info = dragInfo.current;
      if (!info.width) return;
      const dx = e.touches[0].clientX - info.startX;
      const dy = e.touches[0].clientY - info.startY;

      if (info.locked === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        info.locked = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (info.locked !== "horizontal") return;

      e.preventDefault();
      const maxOffset = -(VIEWS.length - 1) * info.width;
      const next = Math.max(maxOffset, Math.min(0, info.baseOffset + dx));
      setDragOffset(next);
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [addingExercise]);

  const handleTouchEnd = () => {
    const info = dragInfo.current;
    if (info.locked === "horizontal" && dragOffset !== null && info.width) {
      const targetIndex = Math.max(0, Math.min(VIEWS.length - 1, Math.round(-dragOffset / info.width)));
      setView(VIEWS[targetIndex]);
    }
    setDragOffset(null);
    dragInfo.current.locked = null;
  };

  const fileInputRef = useRef(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(workouts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = todayISO();
    a.href = url;
    a.download = `iron-log-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        setImportPending(parsed);
      } catch (err) {
        setImportError("That file doesn't look like a valid Iron Log backup.");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (importPending) persist(importPending);
    setImportPending(null);
  };

  if (workouts === null) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.centerFill, color: "#8E8E8E", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" }}>Loading…</div>
      </div>
    );
  }

  const today = todayISO();
  let todaysWorkout = workouts.find((w) => w.date === today);

  const ensureTodaysWorkout = (wList) => {
    let list = wList;
    let w = list.find((x) => x.date === today);
    if (!w) {
      w = { date: today, exercises: [] };
      list = [w, ...list];
    }
    return { list, workout: w };
  };

  const addExercise = () => {
    const name = customMode ? customName.trim() : currentExerciseName;
    if (!name) {
      setAddingExercise(false);
      return;
    }
    const { list, workout } = ensureTodaysWorkout(workouts);
    const updatedWorkout = {
      ...workout,
      exercises: [
        ...workout.exercises,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, sets: [] },
      ],
    };
    const next = list.map((w) => (w.date === today ? updatedWorkout : w));
    persist(next);
    setCustomName("");
    setCustomMode(false);
    setGroupIdx(0);
    setExerciseIdx(0);
    setAddingExercise(false);
    setExpanded((e) => ({ ...e, [updatedWorkout.exercises[updatedWorkout.exercises.length - 1].id]: true }));
  };

  const removeExercise = (exId) => {
    if (!todaysWorkout) return;
    const updatedWorkout = { ...todaysWorkout, exercises: todaysWorkout.exercises.filter((ex) => ex.id !== exId) };
    persist(workouts.map((w) => (w.date === today ? updatedWorkout : w)));
  };

  const addSet = (exId, weight, reps) => {
    if (!todaysWorkout) return;
    const updatedWorkout = {
      ...todaysWorkout,
      exercises: todaysWorkout.exercises.map((ex) =>
        ex.id === exId ? { ...ex, sets: [...ex.sets, { weight, reps }] } : ex
      ),
    };
    persist(workouts.map((w) => (w.date === today ? updatedWorkout : w)));
  };

  const removeSet = (exId, setIdx) => {
    if (!todaysWorkout) return;
    const updatedWorkout = {
      ...todaysWorkout,
      exercises: todaysWorkout.exercises.map((ex) =>
        ex.id === exId ? { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) } : ex
      ),
    };
    persist(workouts.map((w) => (w.date === today ? updatedWorkout : w)));
  };

  const totalVolumeToday = todaysWorkout
    ? todaysWorkout.exercises.reduce((sum, ex) => sum + volumeOf(ex), 0)
    : 0;
  const totalSetsToday = todaysWorkout
    ? todaysWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    : 0;

  const pastWorkouts = workouts
    .filter((w) => w.date !== today || (todaysWorkout && todaysWorkout.exercises.length > 0))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Progress stats: chronological (oldest first) list of every logged
  // workout with its total volume, for the chart and streak calculation.
  const loggedWorkouts = workouts
    .filter((w) => w.exercises.some((ex) => ex.sets.length > 0))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const workoutVolumes = loggedWorkouts.map((w) => ({
    date: w.date,
    volume: w.exercises.reduce((sum, ex) => sum + volumeOf(ex), 0),
  }));
  const recentVolumes = workoutVolumes.slice(-8);
  const maxVolume = Math.max(1, ...recentVolumes.map((w) => w.volume));
  const allTimeVolume = workoutVolumes.reduce((sum, w) => sum + w.volume, 0);
  const totalWorkoutsLogged = loggedWorkouts.length;

  let currentStreak = 0;
  {
    const loggedDates = new Set(loggedWorkouts.map((w) => w.date));
    let cursor = new Date();
    // If today has nothing logged yet, start counting from yesterday so an
    // in-progress streak doesn't look broken before the day is even over.
    if (!loggedDates.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
        cursor.getDate()
      ).padStart(2, "0")}`;
      if (!loggedDates.has(iso)) break;
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #000000; overscroll-behavior: none; }
        #root { min-height: 100dvh; background: #000000; }
        input::placeholder { color: #6E6E6E; }
        button { cursor: pointer; transition: transform 0.12s ease, opacity 0.12s ease; }
        button:active { transform: scale(0.96); opacity: 0.72; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
      `}</style>

      <div style={styles.shell}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>IRON LOG</div>
            <div style={styles.headerDate}>
              {view === "today" ? "Today" : view === "history" ? "History" : "Progress"}
            </div>
          </div>
          <div style={styles.statPair}>
            <div style={styles.statBlock}>
              <div style={styles.statNum}>{totalSetsToday}</div>
              <div style={styles.statLabel}>SETS</div>
            </div>
            <div style={styles.statBlock}>
              <div style={styles.statNum}>{totalVolumeToday.toLocaleString()}</div>
              <div style={styles.statLabel}>VOLUME</div>
            </div>
          </div>
        </div>

        <div
          style={styles.viewport}
          ref={viewportRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{
              ...styles.track,
              transform:
                dragOffset !== null
                  ? `translateX(${dragOffset}px)`
                  : `translateX(${-viewIndex * (100 / VIEWS.length)}%)`,
              transition: dragOffset !== null ? "none" : styles.track.transition,
            }}
          >
            <div style={styles.pane}>
              <div style={styles.list}>
                {(!todaysWorkout || todaysWorkout.exercises.length === 0) && !addingExercise && (
                  <div style={styles.emptyState}>
                    <Dumbbell size={28} color="#4D4D4D" strokeWidth={1.5} />
                    <div style={styles.emptyTitle}>No exercises logged yet</div>
                    <div style={styles.emptySub}>Add your first exercise to start today's session.</div>
                  </div>
                )}

                {todaysWorkout &&
                  todaysWorkout.exercises.map((ex) => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      expanded={!!expanded[ex.id]}
                      onToggle={() => setExpanded((e) => ({ ...e, [ex.id]: !e[ex.id] }))}
                      onAddSet={(weight, reps) => addSet(ex.id, weight, reps)}
                      onRemoveSet={(idx) => removeSet(ex.id, idx)}
                      onRemoveExercise={() => removeExercise(ex.id)}
                    />
                  ))}

                <button
                  style={styles.addExerciseBtn}
                  onClick={() => {
                    getAudioCtx();
                    setAddingExercise(true);
                  }}
                >
                  <Plus size={18} />
                  <span>Add exercise</span>
                </button>
              </div>
            </div>

            <div style={styles.pane}>
              <div style={styles.list}>
                {pastWorkouts.length === 0 && (
                  <div style={styles.emptyState}>
                    <History size={28} color="#4D4D4D" strokeWidth={1.5} />
                    <div style={styles.emptyTitle}>No history yet</div>
                    <div style={styles.emptySub}>Logged workouts will show up here.</div>
                  </div>
                )}
                {pastWorkouts.map((w) => (
                  <HistoryCard key={w.date} workout={w} />
                ))}
              </div>
            </div>

            <div style={styles.pane}>
              <div style={styles.list}>
                {loggedWorkouts.length === 0 ? (
                  <div style={styles.emptyState}>
                    <Flame size={28} color="#4D4D4D" strokeWidth={1.5} />
                    <div style={styles.emptyTitle}>No progress yet</div>
                    <div style={styles.emptySub}>Log a few workouts and your trends will show up here.</div>
                  </div>
                ) : (
                  <>
                    <div style={styles.statsRow}>
                      <div style={styles.statCard}>
                        <div style={styles.statCardNum}>{totalWorkoutsLogged}</div>
                        <div style={styles.statCardLabel}>WORKOUTS</div>
                      </div>
                      <div style={styles.statCard}>
                        <div style={styles.statCardNum}>{currentStreak}</div>
                        <div style={styles.statCardLabel}>DAY STREAK</div>
                      </div>
                      <div style={styles.statCard}>
                        <div style={styles.statCardNum}>{allTimeVolume.toLocaleString()}</div>
                        <div style={styles.statCardLabel}>ALL-TIME VOL</div>
                      </div>
                    </div>

                    <div style={styles.chartCard}>
                      <div style={styles.chartTitle}>Volume — last {recentVolumes.length} workouts</div>
                      <div style={styles.chartRow}>
                        {recentVolumes.map((w, i) => {
                          const h = Math.max(4, Math.round((w.volume / maxVolume) * 120));
                          const [, m, d] = w.date.split("-");
                          return (
                            <div key={w.date + i} style={styles.chartBarCol}>
                              <div style={styles.chartBarTrack}>
                                <div style={{ ...styles.chartBar, height: h }} />
                              </div>
                              <div style={styles.chartBarLabel}>
                                {m}/{d}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div style={styles.backupRow}>
                  <button style={styles.ghostBtn} onClick={handleExport}>
                    Export backup
                  </button>
                  <button style={styles.ghostBtn} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                    Import backup
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    style={{ display: "none" }}
                    onChange={handleImportFile}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add-exercise bottom sheet */}
      <div
        style={{
          ...styles.sheetBackdrop,
          opacity: addingExercise ? 1 : 0,
          pointerEvents: addingExercise ? "auto" : "none",
        }}
        onClick={() => {
          setAddingExercise(false);
          setCustomMode(false);
          setCustomName("");
        }}
      />
      <div
        style={{
          ...styles.sheet,
          transform: `translate(-50%, ${addingExercise ? "0%" : "100%"})`,
        }}
      >
        <div style={styles.sheetTitle}>Add exercise</div>
        <div style={styles.sheetCard}>
          {customMode ? (
            <>
              <input
                ref={nameInputRef}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addExercise();
                  if (e.key === "Escape") setCustomMode(false);
                }}
                placeholder="Exercise name"
                style={styles.exerciseNameInput}
              />
              <button style={styles.linkBtn} onClick={() => setCustomMode(false)}>
                ← Back to picker
              </button>
            </>
          ) : (
            <>
              <div style={wheelStyles.pickerRow}>
                <WheelPicker
                  options={MUSCLE_GROUPS}
                  index={groupIdx}
                  onChange={(i) => {
                    setGroupIdx(i);
                    setExerciseIdx(0);
                  }}
                />
                <WheelPicker
                  options={currentExerciseList}
                  index={Math.min(exerciseIdx, currentExerciseList.length - 1)}
                  onChange={setExerciseIdx}
                />
              </div>
              <button style={styles.linkBtn} onClick={() => setCustomMode(true)}>
                Type a custom exercise instead
              </button>
            </>
          )}
        </div>

        <div style={styles.sheetCircleBtnRow}>
          <button
            style={styles.sheetCircleBtnCancel}
            onClick={() => {
              setAddingExercise(false);
              setCustomMode(false);
              setCustomName("");
            }}
          >
            Cancel
          </button>
          <button style={styles.sheetCircleBtnAdd} onClick={addExercise}>
            Add
          </button>
        </div>
      </div>

      {/* Custom iOS-style alert — import confirmation / error */}
      {(importPending || importError) && (
        <>
          <div style={styles.alertBackdrop} onClick={() => { setImportPending(null); setImportError(null); }} />
          <div style={styles.alertCard}>
            {importPending ? (
              <>
                <div style={styles.alertTitle}>Import backup?</div>
                <div style={styles.alertMessage}>
                  This will replace all data currently in the app with {importPending.length} workout day
                  {importPending.length === 1 ? "" : "s"} from the file.
                </div>
                <div style={styles.alertBtnRow}>
                  <button style={styles.alertBtnGhost} onClick={() => setImportPending(null)}>
                    Cancel
                  </button>
                  <button style={styles.alertBtnPrimary} onClick={confirmImport}>
                    Import
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={styles.alertTitle}>Import failed</div>
                <div style={styles.alertMessage}>{importError}</div>
                <div style={styles.alertBtnRow}>
                  <button style={styles.alertBtnPrimary} onClick={() => setImportError(null)}>
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Bottom nav */}
      <div style={styles.bottomNav}>
        <div
          style={{
            ...styles.navSlider,
            transform: `translateX(${viewIndex * 100}%)`,
          }}
        />
        <button style={styles.navBtn} onClick={() => setView("today")}>
          <Flame size={18} strokeWidth={2} color={view === "today" ? "#C7A15A" : "#8E8E8E"} />
          <span style={view === "today" ? styles.navLabelActive : styles.navLabel}>Today</span>
        </button>
        <button style={styles.navBtn} onClick={() => setView("history")}>
          <History size={18} strokeWidth={2} color={view === "history" ? "#C7A15A" : "#8E8E8E"} />
          <span style={view === "history" ? styles.navLabelActive : styles.navLabel}>History</span>
        </button>
        <button style={styles.navBtn} onClick={() => setView("progress")}>
          <TrendsIcon size={18} strokeWidth={2} color={view === "progress" ? "#C7A15A" : "#8E8E8E"} />
          <span style={view === "progress" ? styles.navLabelActive : styles.navLabel}>Progress</span>
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, expanded, onToggle, onAddSet, onRemoveSet, onRemoveExercise }) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const submit = () => {
    const w = weight === "" ? 0 : Number(weight);
    const r = reps === "" ? 0 : Number(reps);
    if (r <= 0) return;
    onAddSet(w, r);
    setReps("");
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardTop} onClick={onToggle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.exerciseName}>{exercise.name}</div>
          <div style={{ marginTop: 6 }}>
            <LoadBar sets={exercise.sets} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={styles.setCountBadge}>{exercise.sets.length}</div>
          {expanded ? <ChevronUp size={18} color="#8E8E8E" /> : <ChevronDown size={18} color="#8E8E8E" />}
        </div>
      </div>

      {expanded && (
        <div style={styles.cardBody}>
          {exercise.sets.length > 0 && (
            <div style={styles.setRows}>
              {exercise.sets.map((s, i) => (
                <div style={styles.setRow} key={i}>
                  <div style={styles.setIndex}>{i + 1}</div>
                  <div style={styles.setData}>
                    {s.weight}
                    <span style={styles.setUnit}> lb</span>
                    <span style={styles.setX}> × </span>
                    {s.reps}
                    <span style={styles.setUnit}> reps</span>
                  </div>
                  <button style={styles.iconBtn} onClick={() => onRemoveSet(i)}>
                    <X size={14} color="#6E6E6E" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.setInputRow}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="lb"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={styles.numInput}
            />
            <div style={styles.setX}>×</div>
            <input
              type="number"
              inputMode="numeric"
              placeholder="reps"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={styles.numInput}
            />
            <button style={styles.addSetBtn} onClick={submit}>
              <Plus size={16} />
            </button>
          </div>

          <button style={styles.removeExerciseBtn} onClick={onRemoveExercise}>
            <Trash2 size={13} />
            <span>Remove exercise</span>
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ workout }) {
  const [open, setOpen] = useState(false);
  const totalVolume = workout.exercises.reduce((sum, ex) => sum + volumeOf(ex), 0);
  const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <div style={styles.card}>
      <div style={styles.cardTop} onClick={() => setOpen((o) => !o)}>
        <div style={{ flex: 1 }}>
          <div style={styles.exerciseName}>{formatDateLabel(workout.date)}</div>
          <div style={styles.historyMeta}>
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""} · {totalSets} sets ·{" "}
            {totalVolume.toLocaleString()} vol
          </div>
        </div>
        {open ? <ChevronUp size={18} color="#8E8E8E" /> : <ChevronDown size={18} color="#8E8E8E" />}
      </div>
      {open && (
        <div style={styles.cardBody}>
          {workout.exercises.map((ex) => (
            <div key={ex.id} style={{ marginBottom: 14 }}>
              <div style={styles.historyExerciseName}>{ex.name}</div>
              <div style={styles.setRows}>
                {ex.sets.map((s, i) => (
                  <div style={styles.setRow} key={i}>
                    <div style={styles.setIndex}>{i + 1}</div>
                    <div style={styles.setData}>
                      {s.weight}
                      <span style={styles.setUnit}> lb</span>
                      <span style={styles.setX}> × </span>
                      {s.reps}
                      <span style={styles.setUnit}> reps</span>
                    </div>
                  </div>
                ))}
                {ex.sets.length === 0 && <div style={{ color: "#6E6E6E", fontSize: 12 }}>No sets recorded</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Styles ----------
const styles = {
  sheetBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    transition: "opacity 0.35s ease",
    zIndex: 40,
  },
  sheet: {
    position: "fixed",
    left: "50%",
    bottom: 0,
    width: "100%",
    maxWidth: 480,
    minHeight: "90vh",
    maxHeight: "96vh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    background: "#0C0C0C",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "22px 20px calc(24px + env(safe-area-inset-bottom))",
    zIndex: 41,
    // Same push/modal easing iOS uses for sheet presentation.
    transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
    boxShadow: "0 -12px 40px rgba(0,0,0,0.45)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sheetHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sheetTitle: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 20,
    color: "#ECE9E2",
    marginBottom: 4,
  },
  sheetCard: {
    background: "#222222",
    borderRadius: 20,
    padding: "24px 16px",
    marginTop: 8,
    minHeight: "36vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  sheetCircleBtnRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    padding: "0 8px",
  },
  sheetCircleBtnCancel: {
    width: 76,
    height: 76,
    borderRadius: "50%",
    background: "#2D2D2D",
    border: "none",
    color: "#ECE9E2",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    fontWeight: 500,
  },
  sheetCircleBtnAdd: {
    width: 76,
    height: 76,
    borderRadius: "50%",
    background: "#C7A15A",
    border: "none",
    color: "#171717",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    fontWeight: 700,
  },
  page: {
    minHeight: "100dvh",
    background: "#000000",
    display: "flex",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
  },
  centerFill: { display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", width: "100%" },
  shell: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100dvh",
    background: "#000000",
    paddingBottom: 90,
    position: "relative",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: "calc(28px + env(safe-area-inset-top)) 20px 18px",
    borderBottom: "1px solid #292929",
  },
  eyebrow: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 11,
    letterSpacing: "0.14em",
    color: "#C7A15A",
    marginBottom: 4,
  },
  headerDate: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 28,
    color: "#ECE9E2",
    letterSpacing: "-0.01em",
  },
  statPair: { display: "flex", gap: 18 },
  statBlock: { textAlign: "right" },
  statNum: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    color: "#ECE9E2",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 9,
    letterSpacing: "0.12em",
    color: "#6E6E6E",
    marginTop: 3,
  },
  viewport: { overflow: "hidden", width: "100%", touchAction: "pan-y" },
  track: {
    display: "flex",
    width: "300%",
    touchAction: "pan-y",
    // Apple's own UINavigationController push-transition curve and duration.
    transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
  },
  pane: { width: "33.3334%", flexShrink: 0, minWidth: 0, touchAction: "pan-y" },
  list: {
    padding: "18px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    touchAction: "pan-y",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    touchAction: "pan-y",
    textAlign: "center",
    padding: "48px 24px",
    gap: 8,
  },
  emptyTitle: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif", fontSize: 16, color: "#ECE9E2", marginTop: 6 },
  emptySub: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif", fontSize: 13, color: "#6E6E6E", maxWidth: 240 },
  card: {
    background: "#1E1E1E",
    border: "1px solid #292929",
    borderRadius: 20,
    touchAction: "pan-y",
    overflow: "hidden",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    touchAction: "pan-y",
    padding: "14px 16px",
    gap: 12,
  },
  exerciseName: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 17,
    fontWeight: 700,
    color: "#ECE9E2",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  setCountBadge: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 12,
    color: "#C7A15A",
    background: "#2B2B2B",
    borderRadius: 20,
    minWidth: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
  },
  cardBody: { padding: "0 16px 16px", borderTop: "1px solid #292929" },
  setRows: { display: "flex", flexDirection: "column", marginTop: 12, gap: 6 },
  setRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#232323",
    borderRadius: 14,
    padding: "8px 10px",
  },
  setIndex: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 11,
    color: "#6E6E6E",
    width: 14,
  },
  setData: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    color: "#ECE9E2",
    flex: 1,
    fontVariantNumeric: "tabular-nums",
  },
  setUnit: { color: "#6E6E6E", fontSize: 12 },
  setX: { color: "#6E6E6E" },
  iconBtn: {
    background: "transparent",
    border: "none",
    padding: 4,
    display: "flex",
    alignItems: "center",
  },
  setInputRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 12 },
  numInput: {
    flex: 1,
    background: "#232323",
    border: "1px solid #363636",
    borderRadius: 12,
    padding: "10px 12px",
    color: "#ECE9E2",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    outline: "none",
    minWidth: 0,
  },
  addSetBtn: {
    background: "#C7A15A",
    border: "none",
    borderRadius: 12,
    width: 38,
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
  },
  removeExerciseBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    color: "#6E6E6E",
    fontSize: 12,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    marginTop: 14,
    padding: 0,
  },
  exerciseNameInput: {
    background: "#232323",
    border: "1px solid #363636",
    borderRadius: 12,
    padding: "10px 12px",
    color: "#ECE9E2",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    outline: "none",
  },
  primaryBtn: {
    background: "#C7A15A",
    border: "none",
    borderRadius: 14,
    padding: "9px 16px",
    color: "#fff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontWeight: 600,
    fontSize: 13,
  },
  ghostBtn: {
    background: "transparent",
    border: "1px solid #363636",
    borderRadius: 14,
    padding: "9px 16px",
    color: "#8E8E8E",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#C7A15A",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 12,
    padding: "2px 0",
    textAlign: "left",
    alignSelf: "flex-start",
  },
  addExerciseBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "pan-y",
    gap: 8,
    background: "transparent",
    border: "1.5px dashed #363636",
    borderRadius: 20,
    padding: "14px",
    color: "#8E8E8E",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    fontWeight: 500,
  },
  historyMeta: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 11,
    color: "#6E6E6E",
    marginTop: 4,
  },
  historyExerciseName: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    color: "#C7A15A",
    marginBottom: 6,
    marginTop: 10,
  },
  bottomNav: {
    position: "fixed",
    bottom: "calc(16px + env(safe-area-inset-bottom))",
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 32px)",
    maxWidth: 448,
    background: "rgba(30, 30, 30, 0.72)",
    backdropFilter: "blur(20px) saturate(160%)",
    WebkitBackdropFilter: "blur(20px) saturate(160%)",
    borderRadius: 34,
    display: "flex",
    padding: "10px 18px",
    gap: 8,
    boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  navSlider: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 6,
    width: "calc(33.3334% - 6px)",
    borderRadius: 28,
    background: "rgba(199, 161, 90, 0.18)",
    border: "1px solid rgba(199, 161, 90, 0.35)",
    transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
    pointerEvents: "none",
  },
  statsRow: {
    display: "flex",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    background: "#1E1E1E",
    border: "1px solid #292929",
    borderRadius: 16,
    padding: "14px 10px",
    textAlign: "center",
  },
  statCardNum: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: "#ECE9E2",
    fontVariantNumeric: "tabular-nums",
  },
  statCardLabel: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 9,
    letterSpacing: "0.08em",
    color: "#6E6E6E",
    marginTop: 4,
  },
  backupRow: {
    display: "flex",
    gap: 10,
    marginTop: 14,
  },
  chartCard: {
    background: "#1E1E1E",
    border: "1px solid #292929",
    borderRadius: 20,
    padding: "18px 16px 14px",
  },
  chartTitle: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: "#8E8E8E",
    marginBottom: 16,
  },
  chartRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    height: 140,
  },
  chartBarCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  chartBarTrack: {
    width: "100%",
    height: 120,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  chartBar: {
    width: "70%",
    background: "linear-gradient(180deg, #C7A15A, #9C7A3E)",
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 9,
    color: "#6E6E6E",
  },
  navBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    border: "none",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 11,
    padding: "2px 0",
    position: "relative",
    zIndex: 1,
  },
  navLabel: {
    color: "#8E8E8E",
    fontWeight: 500,
  },
  navLabelActive: {
    color: "#C7A15A",
    fontWeight: 700,
  },
  alertBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    zIndex: 60,
  },
  alertCard: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(300px, calc(100% - 64px))",
    background: "rgba(40,40,42,0.86)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    padding: "20px 18px 14px",
    zIndex: 61,
    textAlign: "center",
  },
  alertTitle: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 16,
    color: "#ECE9E2",
    marginBottom: 6,
  },
  alertMessage: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    color: "#C8C8C8",
    lineHeight: 1.4,
    marginBottom: 14,
  },
  alertBtnRow: {
    display: "flex",
    gap: 8,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginLeft: -18,
    marginRight: -18,
    paddingTop: 10,
    paddingLeft: 18,
    paddingRight: 18,
  },
  alertBtnGhost: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#8E8E8E",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    fontWeight: 500,
    padding: "8px 0 4px",
  },
  alertBtnPrimary: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#C7A15A",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    fontWeight: 700,
    padding: "8px 0 4px",
  },
};
