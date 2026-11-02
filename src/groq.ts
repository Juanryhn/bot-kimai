import Groq from "groq-sdk";
import {
  GROQ_API_KEY,
  DEFAULT_PROJECT_ID,
  DEFAULT_CUSTOMER_ID,
  kimaiConf,
} from "./config";
import { TimesheetEntry } from "./types";

const groq = new Groq({ apiKey: GROQ_API_KEY });

export async function parseTimesheetEntries(
  userPrompt: string,
): Promise<TimesheetEntry[]> {
  const todayISO = new Date().toISOString().split("T")[0];

  const systemPrompt = `
You are an automatic timesheet parser for Kimai.
Primary task: extract user intent, correct typos, and split into multiple sessions if requested or if duration rules are exceeded.

Description, Progression & Language Rules:
- ALWAYS generate the "description" in clear, natural, professional English regardless of the input language.
- Polish and improvise raw or informal user phrases into articulate, communicative, and humanlike work activity logs.
- STRICT DYNAMIC PROGRESSION REQUIREMENT: When a single user instruction or activity is split into multiple consecutive entries (or totals more than 4 hours), you MUST NOT duplicate the exact same description verbatim across entries. 
- Instead, you must break down the description into sequential, progressive workflow stages across the time blocks (e.g., Session 1: initial coordination, review, or preparation -> Session 2: core execution, troubleshooting, or deep support -> Session 3: verification, testing, or edge-case handling -> Session 4: final validation, wrap-up, or documentation). 
- If the user provides a combined task spanning multiple hours, intelligently distribute logical sub-tasks or progressive phases across each consecutive time slot so that no two adjacent entries share an identical description sentence.

Lunch Break & Working Hours Rules:
- The lunch break is a FIXED, NON-WORKING window: exactly 12:00:00 to 13:00:00. No entry may start, end, or overlap with ANY part of this window — not even by a single minute.
- If the requested time range spans across 12:00:00-13:00:00, you MUST cut it into a morning segment ending at exactly 12:00:00 and an afternoon segment starting at exactly 13:00:00. Do NOT create a separate entry for the lunch window itself.
- Apply this lunch-break split FIRST, before the 4-hour max-duration splitting rule below. Each resulting segment is then independently split further only if it still exceeds 4 hours.
- Never produce an entry with a duration shorter than 10 minutes.

Data Mapping Rules:
- Project ID: ${DEFAULT_PROJECT_ID} (static)
- Customer ID: ${DEFAULT_CUSTOMER_ID} (static)
- Today's date (if the user does not specify): ${todayISO}

Activity Mapping Rules:
${Object.entries(kimaiConf.activities)
  .map(([id, desc]) => `- ID ${id}: ${desc}`)
  .join("\n")}

Splitting Rules (MANDATORY, Kimai rejects entries longer than 4 hours):
- Maximum duration per entry is exactly 4 hours (240 minutes). This is a HARD LIMIT that overrides every other instruction. No exceptions.
- If a continuous time range or segment exceeds 4 hours, you MUST split it into multiple consecutive entries, each at most 4 hours long.
- The split entries MUST be back-to-back with zero gaps and zero overlaps, and together MUST cover the user's ENTIRE original time range exactly.
- Split as evenly as possible. Example: a 7-hour afternoon block (13:00-20:00) must be split into 13:00-17:00 (4h) and 17:00-20:00 (3h).

Self-check before returning (do this for every entry, no exceptions):
- Compute (end - begin) in minutes for each entry you are about to output.
- If any entry exceeds 240 minutes, split it further and recheck before returning.
- Ensure descriptions across split sessions of the same activity are distinct and follow a progressive timeline.

Time format: ISO string YYYY-MM-DDTHH:mm:ss.

Return a JSON response with an "entries" property containing an array of timesheet entries. Example format:
{
  "entries": [
    {
      "project": ${DEFAULT_PROJECT_ID},
      "activity": 25,
      "begin": "${todayISO}T09:00:00",
      "end": "${todayISO}T11:00:00",
      "description": "Initial coordination and environment preparation for blue deployment setup"
    },
    {
      "project": ${DEFAULT_PROJECT_ID},
      "activity": 25,
      "begin": "${todayISO}T11:00:00",
      "end": "${todayISO}T12:00:00",
      "description": "Investigating RFS issue history transaction logs and tracing edge cases"
    }
  ]
}
`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: "openai/gpt-oss-120b",
    temperature: 0.4, // Dinaikkan sedikit lagi agar variasi penulisan progres kalimatnya jauh lebih kaya dan tidak monoton
    response_format: { type: "json_object" },
  });

  const rawResponse = completion.choices[0]?.message?.content || "{}";
  const parsedData = JSON.parse(rawResponse);

  const timesheetEntries: TimesheetEntry[] = Array.isArray(parsedData)
    ? parsedData
    : parsedData.entries || [];

  console.log("timesheetEntries: ", timesheetEntries);

  return timesheetEntries;
}
