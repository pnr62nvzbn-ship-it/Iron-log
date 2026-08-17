import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Trash2, ChevronDown, ChevronUp, Dumbbell, History, Flame } from "lucide-react";

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
const WHEEL_ITEM_H = 40;
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

    // Track the exact scroll position every frame so the text scale/opacity
    // moves in lockstep with the finger instead of jumping after a delay.
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
      <div style={wheelStyles.centerHighlight} />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          ...wheelStyles.scroller,
          paddingTop: WHEEL_PAD,
          paddingBottom: WHEEL_PAD,
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
                color: selected ? "#ECE9E2" : "#8B8D93",
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
  pickerRow: { display: "flex", gap: 10 },
  wrap: {
    position: "relative",
    height: WHEEL_HEIGHT,
    flex: 1,
    overflow: "hidden",
    touchAction: "pan-y",
    overscrollBehavior: "contain",
  },
  centerHighlight: {
    position: "absolute",
    top: WHEEL_PAD,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_H,
    background: "#212327",
    borderRadius: 12,
    borderTop: "1px solid #33353A",
    borderBottom: "1px solid #33353A",
    pointerEvents: "none",
  },
  scroller: {
    height: "100%",
    overflowY: "scroll",
    overflowX: "hidden",
    touchAction: "pan-y",
    overscrollBehavior: "contain",
    scrollSnapType: "y mandatory",
    WebkitOverflowScrolling: "touch",
  },
  item: {
    height: WHEEL_ITEM_H,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 17,
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
        <div style={{ fontSize: 11, color: "#6b6d73", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" }}>no sets yet</div>
      )}
    </div>
  );
}

// ---------- Main App ----------
export default function WorkoutLogger() {
  const [workouts, setWorkouts] = useState(null); // null = loading
  const [view, setView] = useState("today"); // today | history
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
      baseOffset: view === "today" ? 0 : -width,
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
      const next = Math.max(-info.width, Math.min(0, info.baseOffset + dx));
      setDragOffset(next);
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [addingExercise]);

  const handleTouchEnd = () => {
    const info = dragInfo.current;
    if (info.locked === "horizontal" && dragOffset !== null) {
      const next = dragOffset < -info.width / 2 ? "history" : "today";
      setView(next);
    }
    setDragOffset(null);
    dragInfo.current.locked = null;
  };

  if (workouts === null) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.centerFill, color: "#8B8D93", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" }}>Loading…</div>
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

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        html, body { overscroll-behavior: none; }
        input::placeholder { color: #6b6d73; }
        button { cursor: pointer; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
      `}</style>

      <div style={styles.shell}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>IRON LOG</div>
            <div style={styles.headerDate}>{view === "today" ? "Today" : "History"}</div>
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
                  : `translateX(${view === "today" ? "0%" : "-50%"})`,
              transition: dragOffset !== null ? "none" : styles.track.transition,
            }}
          >
            <div style={styles.pane}>
              <div style={styles.list}>
                {(!todaysWorkout || todaysWorkout.exercises.length === 0) && !addingExercise && (
                  <div style={styles.emptyState}>
                    <Dumbbell size={28} color="#4a4c52" strokeWidth={1.5} />
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
                    <History size={28} color="#4a4c52" strokeWidth={1.5} />
                    <div style={styles.emptyTitle}>No history yet</div>
                    <div style={styles.emptySub}>Logged workouts will show up here.</div>
                  </div>
                )}
                {pastWorkouts.map((w) => (
                  <HistoryCard key={w.date} workout={w} />
                ))}
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

      {/* Bottom nav */}
      <div style={styles.bottomNav}>
        <div
          style={{
            ...styles.navSlider,
            transform: `translateX(${view === "today" ? "0%" : "100%"})`,
          }}
        />
        <button style={styles.navBtn} onClick={() => setView("today")}>
          <Flame size={18} strokeWidth={2} color={view === "today" ? "#C7A15A" : "#8B8D93"} />
          <span style={view === "today" ? styles.navLabelActive : styles.navLabel}>Today</span>
        </button>
        <button style={styles.navBtn} onClick={() => setView("history")}>
          <History size={18} strokeWidth={2} color={view === "history" ? "#C7A15A" : "#8B8D93"} />
          <span style={view === "history" ? styles.navLabelActive : styles.navLabel}>History</span>
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
          {expanded ? <ChevronUp size={18} color="#8B8D93" /> : <ChevronDown size={18} color="#8B8D93" />}
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
                    <X size={14} color="#6b6d73" />
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
        {open ? <ChevronUp size={18} color="#8B8D93" /> : <ChevronDown size={18} color="#8B8D93" />}
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
                {ex.sets.length === 0 && <div style={{ color: "#6b6d73", fontSize: 12 }}>No sets recorded</div>}
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
    minHeight: "88vh",
    background: "#111214",
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
    background: "#232529",
    borderRadius: 20,
    padding: "20px 16px",
    marginTop: 8,
    minHeight: "56vh",
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
    background: "#2A2C31",
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
    color: "#16171A",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 15,
    fontWeight: 700,
  },
  page: {
    minHeight: "100vh",
    background: "#16171A",
    display: "flex",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
  },
  centerFill: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", width: "100%" },
  shell: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100vh",
    background: "#16171A",
    paddingBottom: 90,
    position: "relative",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: "calc(28px + env(safe-area-inset-top)) 20px 18px",
    borderBottom: "1px solid #26282D",
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
    color: "#6b6d73",
    marginTop: 3,
  },
  viewport: { overflow: "hidden", width: "100%", touchAction: "pan-y" },
  track: {
    display: "flex",
    width: "200%",
    // Apple's own UINavigationController push-transition curve and duration.
    transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
  },
  pane: { width: "50%", flexShrink: 0, minWidth: 0 },
  list: { padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "48px 24px",
    gap: 8,
  },
  emptyTitle: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif", fontSize: 16, color: "#ECE9E2", marginTop: 6 },
  emptySub: { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif", fontSize: 13, color: "#6b6d73", maxWidth: 240 },
  card: {
    background: "#1C1E22",
    border: "1px solid #26282D",
    borderRadius: 20,
    overflow: "hidden",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
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
    background: "#2B2618",
    borderRadius: 20,
    minWidth: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
  },
  cardBody: { padding: "0 16px 16px", borderTop: "1px solid #26282D" },
  setRows: { display: "flex", flexDirection: "column", marginTop: 12, gap: 6 },
  setRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#212327",
    borderRadius: 14,
    padding: "8px 10px",
  },
  setIndex: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 11,
    color: "#6b6d73",
    width: 14,
  },
  setData: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    color: "#ECE9E2",
    flex: 1,
    fontVariantNumeric: "tabular-nums",
  },
  setUnit: { color: "#6b6d73", fontSize: 12 },
  setX: { color: "#6b6d73" },
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
    background: "#212327",
    border: "1px solid #33353A",
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
    color: "#6b6d73",
    fontSize: 12,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    marginTop: 14,
    padding: 0,
  },
  exerciseNameInput: {
    background: "#212327",
    border: "1px solid #33353A",
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
    border: "1px solid #33353A",
    borderRadius: 14,
    padding: "9px 16px",
    color: "#8B8D93",
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
    gap: 8,
    background: "transparent",
    border: "1.5px dashed #33353A",
    borderRadius: 20,
    padding: "14px",
    color: "#8B8D93",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    fontWeight: 500,
  },
  historyMeta: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    fontSize: 11,
    color: "#6b6d73",
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
    background: "#1C1E22",
    borderRadius: 34,
    display: "flex",
    padding: "10px 18px",
    gap: 8,
    boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
    border: "1px solid #2A2C31",
    overflow: "hidden",
  },
  navSlider: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 6,
    width: "calc(50% - 6px)",
    borderRadius: 28,
    background: "rgba(199, 161, 90, 0.18)",
    border: "1px solid rgba(199, 161, 90, 0.35)",
    transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
    pointerEvents: "none",
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
    color: "#8B8D93",
    fontWeight: 500,
  },
  navLabelActive: {
    color: "#C7A15A",
    fontWeight: 700,
  },
};
