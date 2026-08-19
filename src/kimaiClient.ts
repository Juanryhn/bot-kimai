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
    const errorData = (await res.json()) as { message?: string };
    throw new Error(`Kimai Error: ${errorData.message || res.statusText}`);
  }

  return (await res.json()) as KimaiResponse;
}
