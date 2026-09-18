import Groq from "groq-sdk";
import {
  GROQ_API_KEY,
  DEFAULT_PROJECT_ID,
  DEFAULT_CUSTOMER_ID,
  kimaiConf
} from "./config";
import { TimesheetEntry } from "./types";

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

Lunch Break & Working Hours Rules:
- The lunch break is a FIXED, NON-WORKING window: exactly 12:00:00 to 13:00:00. No entry may start, end, or overlap with ANY part of this window — not even by a single minute.
- If the requested time range spans across 12:00:00-13:00:00, you MUST cut it into a morning segment ending at exactly 12:00:00 and an afternoon segment starting at exactly 13:00:00. Do NOT create a separate entry for the lunch window itself.
- Apply this lunch-break split FIRST, before the 2-hour max-duration splitting rule below. Each resulting segment is then independently split further only if it still exceeds 2 hours.
- Never produce an entry with a duration shorter than 10 minutes. A range like "12:00-12:01" is a calculation artifact, not a real work session, and must never appear in the output.

Data Mapping Rules:
- Project ID: ${DEFAULT_PROJECT_ID} (static)
- Customer ID: ${DEFAULT_CUSTOMER_ID} (static)
- Today's date (if the user does not specify): ${todayISO}

Activity Mapping Rules:
${Object.entries(kimaiConf.activities)
  .map(([id, desc]) => `- ID ${id}: ${desc}`)
  .join("\n")}

Splitting Rules (MANDATORY, Kimai rejects entries longer than 2 hours):
- Maximum duration per entry is exactly 2 hours (120 minutes). This is a HARD LIMIT that overrides every other instruction, including any user request to group or consolidate activities. No exceptions.
- If the user's requested time range is longer than 2 hours, you MUST split it into multiple consecutive entries, each at most 2 hours long.
- The split entries MUST be back-to-back with zero gaps and zero overlaps, and together MUST cover the user's ENTIRE original time range exactly — do not drop or shorten any part of the requested duration, except for the mandatory lunch-break gap above.
- Split as evenly as possible. Example: a 3-hour block (15:00–18:00) becomes two entries: 15:00–17:00 (2h) and 17:00–18:00 (1h) — NOT 15:00–17:00 with the remaining hour discarded.
- Example combining lunch-break split + 2-hour cap: a request for 08:00–15:00 (7 hours, spans lunch) is FIRST split by the lunch break into 08:00–12:00 (4h) and 13:00–15:00 (2h). The morning segment still exceeds 2 hours, so it is further split into 08:00–10:00 and 10:00–12:00. The afternoon segment is exactly 2 hours, so it stays as a single entry. Final result: 08:00–10:00, 10:00–12:00, 13:00–15:00 — three entries total, nothing touching 12:00–13:00.
- All split entries from the same original request share the same "project", "activity", and "description" (same activity, just divided across time).
- If the user explicitly asks to divide a single continuous time range into a specific number of duration-based parts (e.g. "bagi 2 jamnya"), honor that number of parts ONLY if each resulting part still stays within the 2-hour max — otherwise increase the number of parts as needed. This is different from category grouping below.

Category Grouping vs Duration Splitting (these are two SEPARATE concerns — never confuse them):
- When the user asks to consolidate work into a specific number of ACTIVITIES/CATEGORIES (e.g. "dibagi 2 aja bugfix dan meeting"), that instruction ONLY controls which "activity" and "description" values get shared across time ranges. It does NOT control how many entries you return, and it does NOT exempt anything from the 2-hour max-duration rule above.
- If all the time ranges belonging to one category add up to more than 2 hours total, you MUST still emit multiple back-to-back entries for that category, each ≤2 hours, all sharing the same "activity" and "description". A single category is allowed to span many entries.
- Worked example: user reports 08:00-12:00 and 13:00-15:00 as "bugfix", 15:00-17:00 as "meeting", and says "dibagi 2 aja bugfix dan meeting". Correct output is 4 entries: 08:00-10:00 (bugfix), 10:00-12:00 (bugfix), 13:00-15:00 (bugfix), 15:00-17:00 (meeting). NEVER collapse 08:00-12:00 into one 4-hour bugfix entry — that violates the 2-hour cap even though it's "one category".

Self-check before returning (do this for every entry, no exceptions):
- Compute (end - begin) in minutes for each entry you are about to output.
- If any entry exceeds 120 minutes, that is an error — split it further and recheck before returning. This check overrides any grouping/category instruction from the user.

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
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
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
