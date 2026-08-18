import { Telegraf, Context } from 'telegraf';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import http from 'http';

dotenv.config();

interface KimaiConfig {
  activities: Record<string, string>;
}

interface TimesheetEntry {
  project: number;
  activity: number;
  begin: string;
  end: string;
  description: string;
}

interface KimaiResponse {
  id: number;
  begin: string;
  end: string;
  project: number;
  activity: number;
  description: string;
}

const {
  TELEGRAM_BOT_TOKEN,
  ALLOWED_TELEGRAM_USER_ID,
  GROQ_API_KEY,
  KIMAI_URL,
  KIMAI_USER,
  KIMAI_TOKEN,
  KIMAI_DEFAULT_CUSTOMER,
  KIMAI_DEFAULT_PROJECT,
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !GROQ_API_KEY || !KIMAI_URL || !KIMAI_USER || !KIMAI_TOKEN || !KIMAI_DEFAULT_CUSTOMER ||
  !KIMAI_DEFAULT_PROJECT) {
  throw new Error('❌ Environment variables belum lengkap di .env!');
}
// Parse ID menjadi number
const DEFAULT_CUSTOMER_ID = parseInt(KIMAI_DEFAULT_CUSTOMER, 10);
const DEFAULT_PROJECT_ID = parseInt(KIMAI_DEFAULT_PROJECT, 10);

const localPath = path.resolve(process.cwd(), 'kimai-conf.json');
const secretPath = '/etc/secrets/kimai-conf.json';
const configPath = fs.existsSync(secretPath) ? secretPath : localPath;
const kimaiConf: KimaiConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const groq = new Groq({ apiKey: GROQ_API_KEY });

const KIMAI_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${KIMAI_TOKEN}`,
};

const ALLOWED_ID = parseInt(ALLOWED_TELEGRAM_USER_ID || '0', 10);

bot.use((ctx: Context, next: () => Promise<void>) => {
  if (ctx.from && ctx.from.id === ALLOWED_ID) {
    return next();
  }
  return ctx.reply('🚫 Akses ditolak. Bot ini terkunci khusus pemilik.');
});

bot.start((ctx: Context) => {
  ctx.reply(
    '👋 *Bot Kimai Siap!*\n\n' +
      'Gunakan perintah `/ask` untuk mengisi timesheet.\n\n' +
      'Contoh:\n' +
      '`/ask riset komponen kamera dan integrasi custom hook decode qr dari jam 8 sampai 10 pagi`',
    { parse_mode: 'Markdown' }
  );
});

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot Kimai Active!');
}).listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});

async function main() {
  try {
    console.log('🚀 Memulai bot dan menguji koneksi ke Telegram...');
    const botInfo = await bot.telegram.getMe();

    console.log('==============================================');
    console.log(`✅ Bot Kimai AI Berhasil Terhubung! (@${botInfo.username})`);
    console.log('🤖 Status: Standby & Mendengarkan Pesan...');
    console.log('==============================================');

    await bot.launch();
  } catch (err) {
    console.error('❌ Gagal terhubung ke Telegram:', err);
  }
}

bot.command('ask', async (ctx: Context) => {
  const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const userPrompt = messageText.replace('/ask', '').trim();

  if (!userPrompt) {
    return ctx.reply('⚠️ Harap sertakan instruksi setelah perintah `/ask`.');
  }

  await ctx.reply('⚡ Memproses perintah ...');

  try {
    const todayISO = new Date().toISOString().split('T')[0];

    const systemPrompt = `
Kamu adalah parser timesheet otomatis untuk Kimai.
Tugas utama: Ekstrak intent pengguna, koreksi typo, dan bagi ke dalam beberapa sesi jika diminta.

Aturan Pemetaan Data:
- Project ID: ${DEFAULT_PROJECT_ID} (Statis)
- Customer ID: ${DEFAULT_CUSTOMER_ID} (Statis)
- Tanggal hari ini (jika pengguna tidak sebut tanggal): ${todayISO}

Aturan Penentuan Activity ID:
${Object.entries(kimaiConf.activities)
  .map(([id, desc]) => `- ID ${id}: ${desc}`)
  .join('\n')}

Format Waktu: ISO string YYYY-MM-DDTHH:mm:ss.

Kembalikan respon JSON dengan properti "entries" yang berisi array timesheet. Contoh format:
{
  "entries": [
    {
      "project": ${DEFAULT_PROJECT_ID},
      "activity": 4,
      "begin": "${todayISO}T08:00:00",
      "end": "${todayISO}T10:00:00",
      "description": "Deskripsi aktivitas"
    }
  ]
}
`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'openai/gpt-oss-20b',
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';
    const parsedData = JSON.parse(rawResponse);

    const timesheetEntries: TimesheetEntry[] = Array.isArray(parsedData)
      ? parsedData
      : parsedData.entries || [];

    if (!Array.isArray(timesheetEntries) || timesheetEntries.length === 0) {
      throw new Error('Gagal mengekstrak data timesheet dari perintah tersebut.');
    }

    const results: KimaiResponse[] = [];

    for (const entry of timesheetEntries) {
      const response = await fetch(`${KIMAI_URL}/timesheets`, {
        method: 'POST',
        headers: KIMAI_HEADERS,
        body: JSON.stringify({
          begin: entry.begin,
          end: entry.end,
          project: entry.project,
          activity: entry.activity,
          description: entry.description,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(`Kimai Error: ${errorData.message || response.statusText}`);
      }

      const created = (await response.json()) as KimaiResponse;
      results.push(created);
    }

    let replyMsg = `✅ *${results.length} Entri Timesheet Berhasil Disimpan!*\n\n`;
    results.forEach((res, idx) => {
      const beginTime = res.begin.split('T')[1].substring(0, 5);
      const endTime = res.end.split('T')[1].substring(0, 5);
      replyMsg +=
        `*Sesi ${idx + 1}:*\n` +
        `• Waktu: ${beginTime} - ${endTime}\n` +
        `• Activity ID: ${res.activity}\n` +
        `• Deskripsi: ${res.description}\n\n`;
    });

    await ctx.reply(replyMsg, { parse_mode: 'Markdown' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan tidak diketahui';
    console.error(err);
    await ctx.reply(`❌ *Gagal memproses:* ${errorMessage}`, { parse_mode: 'Markdown' });
  }
});

main();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));