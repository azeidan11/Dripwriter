// lib/dripFormula.ts

export type DripState = {
  // text tokens and indices
  tokens: string[];
  idx: number;               // current token index (not word count)
  totalWords: number;        // total non-whitespace tokens
  doneWords: number;         // words appended so far

  // timing
  tickMs: number;            // base cadence (you use 2000ms on client)
  startedAt: number;         // ms epoch
  endsAt: number;            // ms epoch
  napUntil?: number;         // if set and now < napUntil, skip this tick

  // tuning (matches your page.tsx)
  basePauseProb?: number;    // ~0.12
  lookaheadTicksBase?: number; // 8
  maxBurstBase?: number;       // 12
  maxBurstCatchup?: number;    // 28
  longNapChance?: number;      // 0.05
  mediumNapChance?: number;    // 0.15
  longNapRange?: [number, number];   // [60_000, 180_000]
  mediumNapRange?: [number, number]; // [15_000, 45_000]
};

// Tokenize preserving whitespace/newlines; returns tokens + totalWords (non-whitespace)
export function tokenizeKeepWhitespace(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const tokens = normalized.match(/\S+|\s+/g) || [];
  const totalWords = tokens.filter((t) => /\S/.test(t)).length;
  return { tokens, totalWords };
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function scheduleNap(range: [number, number]) {
  const [min, max] = range;
  return Date.now() + randInt(min, max);
}

// Core: given current state, decide the next chunk (or a nap/skip)
// Returns { chunkText?, newIdx, addedWords, napUntil? }
export function computeNextChunk(state: DripState) {
  const now = Date.now();

  // Respect an active nap
  if (state.napUntil && now < state.napUntil) {
    return {
      chunkText: "",
      newIdx: state.idx,
      addedWords: 0,
      napUntil: state.napUntil,
    };
  }

  const total = Math.max(1, state.endsAt - state.startedAt);
  const elapsed = Math.max(0, now - state.startedAt);
  const remainingMs = Math.max(0, state.endsAt - now);
  const remainingTicks = Math.max(1, Math.round(remainingMs / state.tickMs));

  const lookaheadTicksBase = state.lookaheadTicksBase ?? 8;
  const lookaheadTicks = Math.min(remainingTicks, lookaheadTicksBase);

  // Targets across the timeline
  const currentTarget = Math.floor(state.totalWords * Math.min(1, elapsed / total));
  const nextTarget = Math.floor(state.totalWords * Math.min(1, (elapsed + state.tickMs) / total));
  const futureTarget = Math.floor(
    state.totalWords * Math.min(1, (elapsed + lookaheadTicks * state.tickMs) / total)
  );

  const remainingWords = state.totalWords - state.doneWords;
  const backlog = Math.max(0, currentTarget - state.doneWords);

  // Capacity
  const maxBurstBase = state.maxBurstBase ?? 12;
  const maxBurstCatchup = state.maxBurstCatchup ?? 28;
  const capacityNormal = remainingTicks * maxBurstBase;
  const isCatchingUp = backlog > 0 || remainingWords > capacityNormal;

  // Naps (variability) — only if we can still finish
  const maxPossibleNoNap = remainingTicks * maxBurstCatchup;
  const canAffordNap = remainingWords <= maxPossibleNoNap && state.doneWords > 0;
  if (canAffordNap) {
    const longNapChance = state.longNapChance ?? 0.05;
    const mediumNapChance = state.mediumNapChance ?? 0.15;
    const longNapRange = state.longNapRange ?? [60_000, 180_000];
    const mediumNapRange = state.mediumNapRange ?? [15_000, 45_000];
    const elapsedPct = elapsed / total;

    // bias long naps earlier, medium naps mid/late
    const tryLong = Math.random() < longNapChance * (1 - elapsedPct);
    const tryMedium = Math.random() < mediumNapChance * (0.5 + 0.5 * elapsedPct);

    if (tryLong) {
      return {
        chunkText: "",
        newIdx: state.idx,
        addedWords: 0,
        napUntil: scheduleNap(longNapRange),
      };
    }
    if (tryMedium) {
      return {
        chunkText: "",
        newIdx: state.idx,
        addedWords: 0,
        napUntil: scheduleNap(mediumNapRange),
      };
    }
  }

  // Base desired increment
  let toAddTarget = Math.max(0, futureTarget - state.doneWords);
  const minToMeetNext = Math.max(0, nextTarget - state.doneWords);

  // Visible start guarantee
  if (state.doneWords === 0) {
    const firstBurst = Math.max(1, Math.min(12, state.totalWords));
    toAddTarget = Math.max(toAddTarget, firstBurst);
  }

  if (toAddTarget < minToMeetNext) toAddTarget = minToMeetNext;

  // Finish on last tick
  if (remainingTicks <= 1) {
    toAddTarget = remainingWords;
  }

  // Jitter +/- 2
  let toAdd = toAddTarget + (Math.floor(Math.random() * 5) - 2);
  if (toAdd < 0) toAdd = 0;

  // Cap bursts
  const capThisTick = isCatchingUp ? maxBurstCatchup : maxBurstBase;
  if (toAdd > capThisTick) toAdd = capThisTick;

  if (toAdd === 0) {
    return {
      chunkText: "",
      newIdx: state.idx,
      addedWords: 0,
      napUntil: undefined,
    };
  }

  // Build slice, counting only non-whitespace tokens as "words"
  let endIdx = state.idx;
  let remaining = toAdd;
  let appendedWordCount = 0;
  while (endIdx < state.tokens.length && remaining > 0) {
    if (/\S/.test(state.tokens[endIdx])) {
      remaining -= 1;
      appendedWordCount += 1;
    }
    endIdx += 1;
  }

  if (endIdx <= state.idx || appendedWordCount === 0) {
    return {
      chunkText: "",
      newIdx: state.idx,
      addedWords: 0,
      napUntil: undefined,
    };
  }

  const chunkText = state.tokens.slice(state.idx, endIdx).join("");

  return {
    chunkText,
    newIdx: endIdx,
    addedWords: appendedWordCount,
    napUntil: undefined,
  };
}