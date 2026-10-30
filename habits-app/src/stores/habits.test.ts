import { describe, it, expect, vi } from "vitest";
import {
  getLast7Days,
  shortDayLabel,
  currentStreak,
  bestStreak,
  successRate,
  isChecked,
} from "./habits";

const TODAY = "2026-10-26"; // Fixed date for tests

describe("getLast7Days", () => {
  it("returns 7 days including today, oldest first", () => {
    const days = getLast7Days(TODAY); // Monday
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-20"); // Tuesday (6 days ago)
    expect(days[6]).toBe(TODAY); // Today (Monday)
  });

  it("handles month boundaries", () => {
    const days = getLast7Days("2026-03-01"); // March 1st
    expect(days[0]).toBe("2026-02-23"); // February 23rd
    expect(days[6]).toBe("2026-03-01"); // March 1st
  });

  it("handles year boundaries", () => {
    const days = getLast7Days("2026-01-02"); // Jan 2nd
    expect(days[0]).toBe("2025-12-27"); // Dec 27th previous year
    expect(days[6]).toBe("2026-01-02"); // Jan 2nd
  });
});

describe("shortDayLabel", () => {
  it("formats date as 'lun. 26' in French", () => {
    // 2026-10-26 is a Monday
    expect(shortDayLabel("2026-10-26")).toMatch(/^lun\.\s+26$/);
  });

  it("works for different weekdays", () => {
    expect(shortDayLabel("2026-10-27")).toMatch(/^mar\.\s+27$/); // Tuesday
    expect(shortDayLabel("2026-10-28")).toMatch(/^mer\.\s+28$/); // Wednesday
  });
});

describe("currentStreak", () => {
  it("returns 0 when no days checked", () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it("returns 1 when only today is checked", () => {
    expect(currentStreak([TODAY], TODAY)).toBe(1);
  });

  it("returns streak of consecutive days up to today", () => {
    // Checked: 20, 21, 22, 23, 24, 25, 26 (today) = 7 days
    expect(currentStreak(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", TODAY], TODAY)).toBe(7);
  });

  it("stops at first gap from today backwards", () => {
    // Checked: 20, 22, 23, 24, 25, 26 (today) - missing 21
    expect(currentStreak(["2026-10-20", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", TODAY], TODAY)).toBe(5); // 22-26
  });

  it("counts up to yesterday if today not checked", () => {
    // Checked: 20, 21, 22, 23, 24, 25 (yesterday), not today (26)
    expect(currentStreak(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"], TODAY)).toBe(6);
  });

  it("returns 0 if today not checked and yesterday not checked", () => {
    expect(currentStreak(["2026-10-20", "2026-10-21"], TODAY)).toBe(0);
  });

  it("ignores dates outside the 7-day window", () => {
    // Only 10th is checked, but window is 20-26
    expect(currentStreak(["2026-10-10"], TODAY)).toBe(0);
  });
});

describe("bestStreak", () => {
  it("returns 0 for empty array", () => {
    expect(bestStreak([])).toBe(0);
  });

  it("returns 1 for single day", () => {
    expect(bestStreak(["2026-10-26"])).toBe(1);
  });

  it("returns longest consecutive streak", () => {
    // Two streaks: 20-22 (3 days) and 25-26 (2 days)
    expect(bestStreak(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-25", "2026-10-26"])).toBe(3);
  });

  it("handles unsorted input", () => {
    expect(bestStreak(["2026-10-25", "2026-10-20", "2026-10-22", "2026-10-26", "2026-10-21"])).toBe(3);
  });

  it("handles streak across month boundary", () => {
    // 2026-01-30, 31, 2026-02-01, 02 = 4 days
    expect(bestStreak(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"])).toBe(4);
  });

  it("handles streak across year boundary", () => {
    // 2025-12-31, 2026-01-01 = 2 days
    expect(bestStreak(["2025-12-31", "2026-01-01"])).toBe(2);
  });
});

describe("successRate", () => {
  it("returns 0 when no days checked", () => {
    expect(successRate([], TODAY)).toBe(0);
  });

  it("returns 100 when all 7 days checked", () => {
    const days = getLast7Days(TODAY);
    expect(successRate(days, TODAY)).toBe(100);
  });

  it("returns rounded percentage", () => {
    // 3 out of 7 = 42.857...% -> 43%
    expect(successRate(["2026-10-20", "2026-10-22", "2026-10-24"], TODAY)).toBe(43);
    // 4 out of 7 = 57.14...% -> 57%
    expect(successRate(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"], TODAY)).toBe(57);
  });

  it("ignores dates outside the 7-day window", () => {
    const days = getLast7Days(TODAY); // 20-26
    // Add an old date that's outside the window
    expect(successRate([...days, "2026-10-01"], TODAY)).toBe(100);
  });
});

describe("isChecked", () => {
  it("returns true if date in array", () => {
    expect(isChecked([TODAY], TODAY)).toBe(true);
  });

  it("returns false if date not in array", () => {
    expect(isChecked([TODAY], "2026-10-25")).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isChecked([], TODAY)).toBe(false);
  });
});

describe("Day change at midnight", () => {
  it("getLast7Days uses the reference date correctly", () => {
    // Before midnight on Oct 26
    const daysBefore = getLast7Days("2026-10-26");
    // After midnight on Oct 27
    const daysAfter = getLast7Days("2026-10-27");
    
    // The window shifts by one day
    expect(daysBefore[6]).toBe("2026-10-26");
    expect(daysAfter[6]).toBe("2026-10-27");
    expect(daysBefore[0]).toBe("2026-10-20");
    expect(daysAfter[0]).toBe("2026-10-21");
  });

  it("currentStreak continues from yesterday when day changes and today not checked", () => {
    // On Oct 26, streak of 5 (22-26)
    const streak26 = currentStreak(
      ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"],
      "2026-10-26"
    );
    expect(streak26).toBe(5);
    
    // On Oct 27, if 27 not checked yet, streak continues from yesterday (26) = 5 days (22-26)
    const streak27 = currentStreak(
      ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"],
      "2026-10-27"
    );
    expect(streak27).toBe(5); // Still 5 because 22-26 are consecutive
  });

  it("currentStreak resets when day changes and yesterday not checked", () => {
    // On Oct 26: only 26 checked
    const streak26 = currentStreak(["2026-10-26"], "2026-10-26");
    expect(streak26).toBe(1);
    
    // On Oct 27: 25 is yesterday (not 26 since window is 21-27), 27 is today - neither checked
    // For Oct 27, window is 21-27, so yesterday is 26 which is not in our checked dates
    // Wait - if we only have 26 checked, then on Oct 27, yesterday (26) IS checked!
    // To have streak=0, we need yesterday NOT checked, so use a date not in the window
    const streak27 = currentStreak(["2026-10-20"], "2026-10-27");
    expect(streak27).toBe(0); // 20 is outside the 21-27 window
  });

  it("successRate updates when day changes", () => {
    // On Oct 26: 3 out of 7 checked
    const rate26 = successRate(
      ["2026-10-20", "2026-10-22", "2026-10-24"],
      "2026-10-26"
    );
    expect(rate26).toBe(43);
    
    // On Oct 27: window shifts to 21-27, only 22, 24 are in window = 2 out of 7
    const rate27 = successRate(
      ["2026-10-20", "2026-10-22", "2026-10-24"],
      "2026-10-27"
    );
    expect(rate27).toBe(29); // 2/7 = 28.57% -> 29%
  });
});