export interface KimaiConfig {
  activities: Record<string, string>;
}

export interface TimesheetEntry {
  project: number;
  activity: number;
  begin: string;
  end: string;
  description: string;
}

export interface KimaiResponse {
  id: number;
  begin: string;
  end: string;
  project: number;
  activity: number;
  description: string;
}
