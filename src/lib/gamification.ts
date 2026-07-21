export type Badge = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  icon: string;
};

export function computeLevel(xp: number): { level: number; nextAt: number; intoLevel: number } {
  // Simple curve: level n requires 100*n XP total cumulative from 0.
  // level 1: 0-99, level 2: 100-299, level 3: 300-599, i.e. threshold(n) = 50*n*(n-1)
  let level = 1;
  while (50 * level * (level + 1) <= xp) level++;
  const prev = 50 * (level - 1) * level;
  const next = 50 * level * (level + 1);
  return { level, nextAt: next, intoLevel: xp - prev };
}

export function computeBadges(stats: {
  habit_days: number;
  tasks_done: number;
  goals_done: number;
  longestStreak: number;
}): Badge[] {
  return [
    { id: "first-step", label: "First Step", description: "Complete 1 habit day", icon: "🌱", earned: stats.habit_days >= 1 },
    { id: "consistent", label: "Consistent", description: "50 habit days completed", icon: "🔥", earned: stats.habit_days >= 50 },
    { id: "century", label: "Century", description: "100 habit days completed", icon: "💯", earned: stats.habit_days >= 100 },
    { id: "streak-7", label: "Week Streak", description: "7-day streak on any habit", icon: "⚡", earned: stats.longestStreak >= 7 },
    { id: "streak-30", label: "Month Streak", description: "30-day streak on any habit", icon: "🏆", earned: stats.longestStreak >= 30 },
    { id: "doer", label: "Doer", description: "Complete 25 tasks", icon: "✅", earned: stats.tasks_done >= 25 },
    { id: "grinder", label: "Grinder", description: "Complete 100 tasks", icon: "⚙️", earned: stats.tasks_done >= 100 },
    { id: "achiever", label: "Achiever", description: "Reach 1 goal", icon: "🎯", earned: stats.goals_done >= 1 },
    { id: "visionary", label: "Visionary", description: "Reach 5 goals", icon: "🌟", earned: stats.goals_done >= 5 },
  ];
}
