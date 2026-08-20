import { bot } from "../src/bot";
import { WEBHOOK_SECRET } from "../src/config";

export default bot.webhookCallback("/api/webhook", {
  secretToken: WEBHOOK_SECRET,
});
