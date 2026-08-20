import { Telegraf, Context } from "telegraf";

import { TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_USER_ID } from "./config";

import { registerStartHandler } from "./handlers/start";
import { registerAskHandler } from "./handlers/ask";

export const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const ALLOWED_ID = Number(ALLOWED_TELEGRAM_USER_ID);

bot.use((ctx: Context, next) => {
  if (ctx.from?.id === ALLOWED_ID) {
    return next();
  }

  return ctx.reply(
    "🚫 Access denied. This bot is restricted to the owner only.",
  );
});

registerStartHandler(bot);
registerAskHandler(bot);
