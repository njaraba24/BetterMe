import { differenceInCalendarDays, format, subDays } from "date-fns";

export type HabitLog = { habit_id: string; date: string; done: boolean };

/** Returns { current, longest } consecutive-day streaks for `habitId` given its logs. */
export function computeStreaks(habitId: string, logs: HabitLog[]): { current: number; longest: number } {
  const doneDates = new Set(
    logs.filter((l) => l.habit_id === habitId && l.done).map((l) => l.date),
  );
  if (doneDates.size === 0) return { current: 0, longest: 0 };

  // current: walk back from today until a gap
  let current = 0;
  const today = new Date();
  for (let i = 0; i < 3650; i++) {
    const d = format(subDays(today, i), "yyyy-MM-dd");
    if (doneDates.has(d)) current++;
    else {
      if (i === 0) {
        // today not done — allow starting from yesterday
        continue;
      }
      break;
    }
  }

  // longest: sort dates ascending and count consecutive runs
  const sorted = Array.from(doneDates).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    if (differenceInCalendarDays(cur, prev) === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return { current, longest };
}

export const HABIT_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "general", label: "General", color: "#9B9A97" },
  { value: "health", label: "Health", color: "#4DAB9A" },
  { value: "work", label: "Work", color: "#2383E2" },
  { value: "relationships", label: "Relationships", color: "#E255A1" },
  { value: "learning", label: "Learning", color: "#D9822B" },
  { value: "mind", label: "Mind", color: "#9065B0" },
];

export const categoryMeta = (value: string) =>
  HABIT_CATEGORIES.find((c) => c.value === value) ?? HABIT_CATEGORIES[0];
