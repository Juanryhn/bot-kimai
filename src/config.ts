import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { KimaiConfig } from "./types";

dotenv.config();

const env = process.env;

export const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || "";
export const ALLOWED_TELEGRAM_USER_ID = env.ALLOWED_TELEGRAM_USER_ID || "";
export const GROQ_API_KEY = env.GROQ_API_KEY || "";
export const KIMAI_URL = env.KIMAI_URL || "";
export const KIMAI_USER = env.KIMAI_USER || "";
export const KIMAI_TOKEN = env.KIMAI_TOKEN || "";
export const KIMAI_DEFAULT_CUSTOMER = env.KIMAI_DEFAULT_CUSTOMER || "";
export const KIMAI_DEFAULT_PROJECT = env.KIMAI_DEFAULT_PROJECT || "";
export const PORT = Number(env.PORT || 3000);

if (
  !TELEGRAM_BOT_TOKEN ||
  !GROQ_API_KEY ||
  !KIMAI_URL ||
  !KIMAI_USER ||
  !KIMAI_TOKEN ||
  !KIMAI_DEFAULT_CUSTOMER ||
  !KIMAI_DEFAULT_PROJECT
) {
  throw new Error("❌ Required environment variables are missing in .env!");
}

export const DEFAULT_CUSTOMER_ID = parseInt(KIMAI_DEFAULT_CUSTOMER, 10);
export const DEFAULT_PROJECT_ID = parseInt(KIMAI_DEFAULT_PROJECT, 10);

const localPath = path.resolve(process.cwd(), "kimai-conf.json");
const secretPath = "/etc/secrets/kimai-conf.json";
const configPath = fs.existsSync(secretPath) ? secretPath : localPath;
export const kimaiConf: KimaiConfig = JSON.parse(
  fs.readFileSync(configPath, "utf-8"),
);
