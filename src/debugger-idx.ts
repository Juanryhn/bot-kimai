import { Telegraf, Context } from "telegraf";
import { TELEGRAM_BOT_TOKEN, ALLOWED_TELEGRAM_USER_ID } from "./config";
import { startHealthServer, stopServer } from "./local-srvr";
import { registerStartHandler } from "./handlers/start";
import { registerAskHandler } from "./handlers/ask";

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

const server = startHealthServer();

async function main() {
  try {
    console.log("🚀 Starting bot and testing Telegram connection...");
    const botInfo = await bot.telegram.getMe();

    console.log("==============================================");
    console.log(
      `✅ Bot Kimai AI connected successfully! (@${botInfo.username})`,
    );
    console.log("🤖 Status: Standby & Listening for messages...");
    console.log("==============================================");

    await bot.launch();
  } catch (err) {
    console.error("❌ Failed to connect to Telegram:", err);
  }
}
main();

const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  bot.stop(signal);

  stopServer(server).then(() => {
    console.log("🌐 Health check server closed.");
    process.exit(0);
  });
};

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
