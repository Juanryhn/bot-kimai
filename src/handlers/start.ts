import { Telegraf } from "telegraf";

export function registerStartHandler(bot: Telegraf) {
  bot.start((ctx) => {
    ctx.reply(
      "👋 *Kimai Bot Ready!*\n\n" +
        "Use `/ask` to create timesheet entries or `/timesheets` to get a report.\n\n" +
        "Timesheet report examples:\n" +
        "`/timesheets`\n" +
        "`/timesheets 2026-10-19 to 2026-11-17`\n\n" +
        "Example:\n" +
        "`/ask research camera component and integrate custom hook to decode qr from 8 to 10am`",
      { parse_mode: "Markdown" },
    );
  });
}
