// Legacy type exports — these were originally in app/page.tsx
// Kept here so old components (chat-interface, chart-panel, sidebar, etc.) still compile.

export type Message = {
  role: "assistant" | "user";
  content: string;
  attachments?: { name: string; size: number }[];
};

export type ChartType = "monte-carlo" | "pie" | "bar" | "line";

export type EstimationData = {
  projectName?: string;
  location?: string;
  gfa?: string;
  buildingType?: string;
  wageType?: string;
  seismicCategory?: string;
  p10: number;
  p50: number;
  p80: number;
  mean?: number;
  histogram?: { cost: string; frequency: number }[];
  breakdown?: { name: string; value: number }[];
  risks?: { title: string; description: string }[];
  chartType?: ChartType;
  chartData?: any[];
  timestamp: number;
  stage?: string;
};

export type StageSnapshot = {
  stage: string;
  label: string;
  data: EstimationData;
  completedAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
  share_token?: string | null;
  stageSnapshots?: StageSnapshot[];
};
