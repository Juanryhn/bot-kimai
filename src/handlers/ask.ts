import { Telegraf, Context } from "telegraf";
import { parseTimesheetEntries } from "../groq";
import { createTimesheet } from "../kimaiClient";
import { TimesheetEntry } from "../types";

const MAX_REQUESTS = 3;
const WINDOW_MS = 5000;
const PENALTY_MS = 30000;

let requestTimestamps: number[] = [];
let blockedUntil = 0;

export function registerAskHandler(bot: Telegraf) {
  bot.command("ask", async (ctx: Context) => {
    const now = Date.now();

    if (now < blockedUntil) {
      const remainingSec = Math.ceil((blockedUntil - now) / 1000);
      return ctx.reply(
        `⛔ *Temporary Access Blocked!*\nYou're sending commands too quickly. Please wait *${remainingSec} seconds* before trying again.`,
        { parse_mode: "Markdown" },
      );
    }

    requestTimestamps = requestTimestamps.filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );

    if (requestTimestamps.length >= MAX_REQUESTS) {
      blockedUntil = now + PENALTY_MS;
      requestTimestamps = [];

      return ctx.reply(
        `🚨 *Command Limit Exceeded!*\nYou sent more than 3 commands within 5 seconds. Please wait *30 seconds* before using the bot again.`,
        { parse_mode: "Markdown" },
      );
    }

    const messageText =
      ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const userPrompt = messageText.replace("/ask", "").trim();

    if (!userPrompt) {
      return ctx.reply(
        "⚠️ Please include instructions after the `/ask` command.",
      );
    }
    requestTimestamps.push(now);

    await ctx.reply("⚡ Processing your request ...");

    try {
      const timesheetEntries: TimesheetEntry[] =
        await parseTimesheetEntries(userPrompt);

      if (!Array.isArray(timesheetEntries) || timesheetEntries.length === 0) {
        throw new Error("Failed to extract timesheet data from the command.");
      }

      const results = [] as any[];
      for (const entry of timesheetEntries) {
        const created = await createTimesheet(entry);
        results.push(created);
      }

      let replyMsg = `✅ *${results.length} Timesheet Entries Saved Successfully!*\n\n`;
      results.forEach((res, idx) => {
        const beginTime = res.begin.split("T")[1].substring(0, 5);
        const endTime = res.end.split("T")[1].substring(0, 5);
        replyMsg +=
          `*Session ${idx + 1}:*\n` +
          `• Time: ${beginTime} - ${endTime}\n` +
          `• Activity ID: ${res.activity}\n` +
          `• Description: ${res.description}\n\n`;
      });

      await ctx.reply(replyMsg, { parse_mode: "Markdown" });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      console.error(err);
      await ctx.reply(`❌ *Failed to process:* ${errorMessage}`, {
        parse_mode: "Markdown",
      });
    }
  });
}
