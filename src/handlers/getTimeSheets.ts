import { Context, Telegraf } from "telegraf";
import { getTimesheets } from "../kimaiClient";
import { KimaiTimesheet } from "../types";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface DayTotals {
  durationSeconds: number;
  activity28Seconds: number;
  hasActivity28: boolean;
}

const STANDARD_MINIMUM_SECONDS = 8 * 60 * 60;
const ACTIVITY_28_MINIMUM_SECONDS = 2 * 60 * 60;

function formatDate({ year, month, day }: DateParts): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value: string): DateParts | null {
  const match =
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value) ??
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const isIso = match[1].length === 4;
  const year = Number(isIso ? match[1] : match[3]);
  const month = Number(match[2]);
  const day = Number(isIso ? match[3] : match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getDefaultRange(today = new Date()): {
  begin: DateParts;
  end: DateParts;
} {
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 19);
  return {
    begin: {
      year: previousMonth.getFullYear(),
      month: previousMonth.getMonth() + 1,
      day: 19,
    },
    end: {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    },
  };
}

function parseRequestedRange(
  text: string,
): { begin: DateParts; end: DateParts } | { error: string } {
  if (!text.trim()) {
    return getDefaultRange();
  }

  const values = text
    .trim()
    .replace(/\bto\b|\.\./gi, " ")
    .replaceAll(",", " ")
    .split(/\s+/);
  if (values.length !== 2) {
    return {
      error: "Provide both dates, e.g. /timesheets 2026-10-19 2026-11-17.",
    };
  }

  const begin = parseDate(values[0]);
  const end = parseDate(values[1]);
  if (!begin || !end) {
    return {
      error: "Dates must be valid YYYY-MM-DD or DD-MM-YYYY values.",
    };
  }
  if (formatDate(begin) > formatDate(end)) {
    return { error: "The begin date must not be after the end date." };
  }

  return { begin, end };
}

function getWeekdays(begin: DateParts, end: DateParts): DateParts[] {
  const weekdays: DateParts[] = [];
  const current = new Date(Date.UTC(begin.year, begin.month - 1, begin.day));
  const last = Date.UTC(end.year, end.month - 1, end.day);

  while (current.getTime() <= last) {
    const weekday = current.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      weekdays.push({
        year: current.getUTCFullYear(),
        month: current.getUTCMonth() + 1,
        day: current.getUTCDate(),
      });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return weekdays;
}

function getActivityId(activity: KimaiTimesheet["activity"]): number {
  const id = activity && typeof activity === "object" ? activity.id : activity;
  return Number(id);
}

function getDurationSeconds(timesheet: KimaiTimesheet, now: Date): number {
  if (
    timesheet.duration !== undefined &&
    timesheet.duration !== null &&
    Number.isFinite(Number(timesheet.duration))
  ) {
    return Math.max(0, Number(timesheet.duration));
  }

  const begin = Date.parse(timesheet.begin);
  const end = timesheet.end ? Date.parse(timesheet.end) : now.getTime();
  return Number.isFinite(begin) && Number.isFinite(end)
    ? Math.max(0, (end - begin) / 1000)
    : 0;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

function formatReplyDate(date: DateParts): string {
  const month = new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
  return `${String(date.day).padStart(2, "0")}-${month}-${date.year}`;
}

const collectDayTotals = (
  begin: DateParts,
  end: DateParts,
  timesheets: KimaiTimesheet[],
): { totals: Map<string, DayTotals>; vacationDays: number } => {
  const totals = new Map<string, DayTotals>();
  const vacationDates = new Set<string>();
  const beginDate = formatDate(begin);
  const endDate = formatDate(end);
  const now = new Date();

  for (const timesheet of timesheets) {
    const date = timesheet.begin.slice(0, 10);
    const durationSeconds = getDurationSeconds(timesheet, now);
    const isVacation = getActivityId(timesheet.activity) === 28;
    const day = totals.get(date) ?? {
      durationSeconds: 0,
      activity28Seconds: 0,
      hasActivity28: false,
    };
    day.durationSeconds += durationSeconds;
    if (isVacation) {
      day.activity28Seconds += durationSeconds;
      day.hasActivity28 = true;
      if (date >= beginDate && date <= endDate) {
        vacationDates.add(date);
      }
    }
    totals.set(date, day);
  }

  return { totals, vacationDays: vacationDates.size };
};

const isDayComplete = (day?: DayTotals): boolean => {
  if (!day) {
    return false;
  }

  if (day.hasActivity28) {
    return day.activity28Seconds >= ACTIVITY_28_MINIMUM_SECONDS;
  }

  return day.durationSeconds >= STANDARD_MINIMUM_SECONDS;
};

const getCompletionDisplay = (
  filledDays: number,
  totalDays: number,
): { percentage: number; progressBar: string; statusIcon: string } => {
  const percentage = totalDays === 0 ? 100 : (filledDays / totalDays) * 100;
  const progressBlocks = Math.round(percentage / 5);
  const progressBar =
    "🟩".repeat(progressBlocks) + "⬜".repeat(20 - progressBlocks);
  let statusIcon: string;
  if (percentage === 100) {
    statusIcon = "✅";
  } else if (percentage >= 80) {
    statusIcon = "🟡";
  } else {
    statusIcon = "🔴";
  }

  return { percentage, progressBar, statusIcon };
};

const getIncompleteDayLines = (
  incompleteDays: DateParts[],
  totals: Map<string, DayTotals>,
): string[] => {
  if (incompleteDays.length === 0) {
    return ["✅ <b>All weekdays meet the required threshold.</b>"];
  }

  const lines = [
    `⚠️ <b>NEEDS ATTENTION (${incompleteDays.length} ${incompleteDays.length === 1 ? "day" : "days"})</b>`,
  ];

  for (const date of incompleteDays) {
    const dateString = formatDate(date);
    const day = totals.get(dateString);
    let detail: string;

    if (!day) {
      detail = "⏱️ <code>0.0h / 8.0h required</code>";
    } else if (day.hasActivity28) {
      detail = `⏱️ <code>Vacation (Activity 28): ${formatHours(day.activity28Seconds)}h / 2.0h</code>`;
    } else {
      detail = `⏱️ <code>${formatHours(day.durationSeconds)}h / 8.0h required</code>`;
    }

    lines.push(`• <b>${formatReplyDate(date)}</b>\n  ${detail}`);
  }

  return lines;
};

const createReport = (
  begin: DateParts,
  end: DateParts,
  timesheets: KimaiTimesheet[],
): string => {
  const days = getWeekdays(begin, end);
  const { totals, vacationDays } = collectDayTotals(begin, end, timesheets);
  const incompleteDays = days.filter(
    (date) => !isDayComplete(totals.get(formatDate(date))),
  );
  const filledDays = days.length - incompleteDays.length;
  const { percentage, progressBar, statusIcon } = getCompletionDisplay(
    filledDays,
    days.length,
  );

  const lines = [
    "📊 <b>TIMESHEET SUMMARY</b>",
    "",
    `📌 <b>Completion rules:</b> work: 8h total | leave (Activity 28): 2h`,
    "",
    `🗓️ <b>Period:</b> <code>${formatReplyDate(begin)} to ${formatReplyDate(end)}</code>`,
    `🧾 <b>Total entries:</b> ${timesheets.length}`,
    `🏖️ <b>Leave days logged:</b> ${vacationDays}`,
    `${statusIcon} <b>Weekdays complete:</b> <b>${filledDays}/${days.length} (${percentage.toFixed(1)}%)</b>`,
    progressBar,
    "",
  ];

  lines.push(...getIncompleteDayLines(incompleteDays, totals));

  return lines.join("\n");
};

function splitReport(report: string): string[] {
  const chunks: string[] = [];
  let chunk = "";

  for (const line of report.split("\n")) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > 3900 && chunk) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    chunks.push(chunk);
  }
  return chunks;
}

function getCommandText(ctx: Context): string {
  return ctx.message && "text" in ctx.message
    ? ctx.message.text.replace(/^\/\S+/, "").trim()
    : "";
}

export function registerGetTimeSheetsHandler(bot: Telegraf) {
  bot.command(["timesheets", "gettimesheets"], async (ctx: Context) => {
    const range = parseRequestedRange(getCommandText(ctx));
    if ("error" in range) {
      return ctx.reply(range.error);
    }

    const begin = `${formatDate(range.begin)}T00:00:00`;
    const end = `${formatDate(range.end)}T23:59:59`;

    try {
      await ctx.reply("⏳ <b>Fetching timesheets...</b>", {
        parse_mode: "HTML",
      });
      const timesheets = await getTimesheets(begin, end);
      await splitReport(
        createReport(range.begin, range.end, timesheets),
      ).reduce<Promise<unknown>>(
        (previousReply, message) =>
          previousReply.then(() => ctx.reply(message, { parse_mode: "HTML" })),
        Promise.resolve(),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      await ctx.reply(`Failed to fetch timesheets: ${message}`);
    }
  });
}
