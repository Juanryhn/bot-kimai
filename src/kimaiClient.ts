import { TimesheetEntry, KimaiResponse } from "./types";
import { KIMAI_URL, KIMAI_TOKEN } from "./config";

const KIMAI_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${KIMAI_TOKEN}`,
};

export async function createTimesheet(
  entry: TimesheetEntry,
): Promise<KimaiResponse> {
  const res = await fetch(`${KIMAI_URL}/timesheets`, {
    method: "POST",
    headers: KIMAI_HEADERS,
    body: JSON.stringify({
      begin: entry.begin,
      end: entry.end,
      project: entry.project,
      activity: entry.activity,
      description: entry.description,
    }),
  });

  if (!res.ok) {
    const errorData = (await res.json()) as {
      errors: [string];
      children?: Record<string, string>;
    };
    console.log("errorData: ", errorData);
    console.log("errorData: ", errorData?.children);
    throw new Error(`Kimai Error: ${errorData.errors?.[0] || res.statusText}`);
  }

  return (await res.json()) as KimaiResponse;
}
