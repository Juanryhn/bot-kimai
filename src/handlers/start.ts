import { Telegraf } from "telegraf";

export function registerStartHandler(bot: Telegraf) {
  bot.start((ctx) => {
    ctx.reply(
      "👋 *Kimai Bot Ready!*\n\n" +
        "Use the `/ask` command to create timesheet entries.\n\n" +
        "Example:\n" +
        "`/ask research camera component and integrate custom hook to decode qr from 8 to 10am`",
      { parse_mode: "Markdown" },
    );
  });
}
