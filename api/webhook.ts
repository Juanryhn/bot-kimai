import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Telegraf, Context } from "telegraf";
import { TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_USER_ID } from "../src/config";
import { registerStartHandler } from "../src/handlers/start";
import { registerAskHandler } from "../src/handlers/ask";

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const ALLOWED_ID = parseInt(ALLOWED_TELEGRAM_USER_ID || "0", 10);

bot.use((ctx: Context, next: () => Promise<void>) => {
  if (ctx.from && ctx.from.id === ALLOWED_ID) {
    return next();
  }
  return ctx.reply(
    "🚫 Access denied. This bot is restricted to the owner only.",
  );
});

registerStartHandler(bot);
registerAskHandler(bot);

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(
    "🟣 WEBHOOK HIT — method:",
    req.method,
    "body:",
    JSON.stringify(req.body),
  );
  if (req.method !== "POST") {
    return res.status(200).send("Bot Kimai AI is alive");
  }

  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  console.log("secretHeader: ", secretHeader);
  console.log("WEBHOOK_SECRET: ", WEBHOOK_SECRET);
  if (secretHeader !== WEBHOOK_SECRET) {
    return res.status(401).send("unauthorized");
  }

  try {
    await bot.handleUpdate(req.body);
    return res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Failed to handle update:", err);
    return res.status(500).send("error");
  }
}
