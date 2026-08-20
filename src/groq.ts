import Groq from "groq-sdk";
import {
  GROQ_API_KEY,
  DEFAULT_PROJECT_ID,
  DEFAULT_CUSTOMER_ID,
} from "./config";
import { TimesheetEntry } from "./types";
import { kimaiConf } from "./config";

const groq = new Groq({ apiKey: GROQ_API_KEY });

export async function parseTimesheetEntries(
  userPrompt: string,
): Promise<TimesheetEntry[]> {
  const todayISO = new Date().toISOString().split("T")[0];

  const systemPrompt = `
You are an automatic timesheet parser for Kimai.
Primary task: extract user intent, correct typos, and split into multiple sessions if requested.

Description & Language Rules:
- ALWAYS generate the "description" in clear, natural, professional English regardless of the input language.
- Polish and improvise raw or informal user phrases into articulate, communicative, and humanlike work activity logs.

Data Mapping Rules:
- Project ID: ${DEFAULT_PROJECT_ID} (static)
- Customer ID: ${DEFAULT_CUSTOMER_ID} (static)
- Today's date (if the user does not specify): ${todayISO}

Activity Mapping Rules:
${Object.entries(kimaiConf.activities)
  .map(([id, desc]) => `- ID ${id}: ${desc}`)
  .join("\n")}

Splitting Rules (MANDATORY, Kimai rejects entries longer than 2 hours):
- Maximum duration per entry is exactly 2 hours (120 minutes). This is a hard limit, not a suggestion.
- If the user's requested time range is longer than 2 hours, you MUST split it into multiple consecutive entries, each at most 2 hours long.
- The split entries MUST be back-to-back with zero gaps and zero overlaps, and together MUST cover the user's ENTIRE original time range exactly — do not drop or shorten any part of the requested duration.
- Split as evenly as possible. Example: a 3-hour block (15:00–18:00) becomes two entries: 15:00–17:00 (2h) and 17:00–18:00 (1h) — NOT 15:00–17:00 with the remaining hour discarded.
- Another example: a 5-hour block (08:00–13:00) becomes three entries: 08:00–10:00, 10:00–12:00, 12:00–13:00.
- All split entries from the same original request share the same "project", "activity", and "description" (same activity, just divided across time).
- If the user explicitly asks to divide into a specific number of parts (e.g. "bagi 2", "split into 2"), honor that number of parts ONLY if each resulting part still stays within the 2-hour max — otherwise increase the number of parts as needed to satisfy the 2-hour limit, and mention nothing extra, just return correct entries.

Time format: ISO string YYYY-MM-DDTHH:mm:ss.

Return a JSON response with an "entries" property containing an array of timesheet entries. Example format:
{
  "entries": [
    {
      "project": ${DEFAULT_PROJECT_ID},
      "activity": 4,
      "begin": "${todayISO}T08:00:00",
      "end": "${todayISO}T10:00:00",
      "description": "Activity description"
    }
  ]
}
`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    model: "openai/gpt-oss-20b",
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const rawResponse = completion.choices[0]?.message?.content || "{}";
  const parsedData = JSON.parse(rawResponse);

  const timesheetEntries: TimesheetEntry[] = Array.isArray(parsedData)
    ? parsedData
    : parsedData.entries || [];

  return timesheetEntries;
}
