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
