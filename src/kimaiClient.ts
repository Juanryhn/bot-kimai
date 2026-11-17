import { TimesheetEntry, KimaiResponse, KimaiTimesheet } from "./types";
import { KIMAI_URL, KIMAI_TOKEN } from "./config";

const KIMAI_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${KIMAI_TOKEN}`,
};

function getKimaiApiUrl(): string {
  const baseUrl = KIMAI_URL.replace(/\/+$/, "");
  return /\/api$/i.test(baseUrl) ? baseUrl : `${baseUrl}/api`;
}

export async function createTimesheet(
  entry: TimesheetEntry,
): Promise<KimaiResponse> {
  const res = await fetch(`${getKimaiApiUrl()}/timesheets`, {
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

export async function getTimesheets(
  begin: string,
  end: string,
): Promise<KimaiTimesheet[]> {
  const timesheets: KimaiTimesheet[] = [];
  const pageSize = 100;
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      begin,
      end,
      page: String(page),
      size: String(pageSize),
    });
    const res = await fetch(`${getKimaiApiUrl()}/timesheets?${params}`, {
      method: "GET",
      headers: KIMAI_HEADERS,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `Kimai Error: ${errorBody || res.statusText} (HTTP ${res.status})`,
      );
    }

    const result: unknown = await res.json();
    if (!Array.isArray(result)) {
      throw new Error("Kimai returned an unexpected timesheet response.");
    }

    const currentPage = result as KimaiTimesheet[];
    timesheets.push(...currentPage);
    if (currentPage.length < pageSize) {
      return timesheets;
    }

    page += 1;
  }
}
