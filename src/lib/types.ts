// ── Project Data Model (V2) ──

export type ProjectStatus = 'uploading' | 'overview' | 'detail' | 'final' | 'completed';

export type ConfidenceLevel = 'high' | 'low';

export interface ConfirmedField {
  value: string | number | boolean;
  confidence: ConfidenceLevel;
  source: 'ai' | 'user' | 'document';
  edited_at?: string;
}

export interface OverviewQAOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  cost_adjustment?: number; // multiplier: 1.0 = no change, 1.15 = +15%, 0.90 = -10%
}

export interface OverviewQA {
  id: string;
  item_title: string;
  question: string;
  ai_insight: string;
  strategic_context?: string;
  options: OverviewQAOption[];
  selected_option?: string;
  free_text_answer?: string;
  affected_fields: string[];
  answered: boolean;
  answer: string;
  timestamp: number;
}

export interface RoughEstimate {
  min: number;
  max: number;
  per_sf_min: number;
  per_sf_max: number;
}

export interface MonteCarloResult {
  conservative: number;
  mid: number;
  optimistic: number;
}

export interface RiskItem {
  title: string;
  probability: 'HIGH' | 'MEDIUM' | 'LOW';
  cost_impact: string;
  mitigation: string;
  rank: number;
}

export interface HardSoftRatio {
  hard_pct: number;
  soft_pct: number;
}

export interface CSIDivision {
  id: string;
  csi_code: string;
  csi_description: string;
  description: string;
  qty: number | null;
  unit: string;
  rate: number | null;
  amount: number;
  per_sf: number;
  confidence: ConfidenceLevel;
  confidence_reason?: string;
  ai_source?: string;
  ai_benchmark?: string;
}

export interface AIGuess {
  item: string;
  value: string;
  reasoning: string;
  confidence: ConfidenceLevel;
}

export interface AIEvidence {
  item: string;
  value: string;
  source_doc: string;
  page_ref: string;
}

export interface CostSummaryRow {
  category: string;
  hq_building: number;
  aasc_building: number;
  total: number;
  per_sf: number;
  confidence: ConfidenceLevel;
}

export interface EditHistoryEntry {
  field: string;
  old_value: string | number;
  new_value: string | number;
  timestamp: number;
  tab: 'overview' | 'detail' | 'final';
}

export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp?: number;
}

export interface DebugAttachment {
  name: string;
  type: string;  // MIME type
  data: string;  // base64
  size: number;
}

export interface DebugMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
  attachments?: DebugAttachment[];
}

export interface Project {
  id: string;
  user_id: string;
  title: string | null;
  status: ProjectStatus;

  extracted_info: Record<string, any>;
  confirmed_info: Record<string, ConfirmedField>;
  overview_qa: OverviewQA[];
  base_estimate: RoughEstimate | null;
  rough_estimate: RoughEstimate | null;

  monte_carlo: MonteCarloResult | null;
  selected_scenario: 'conservative' | 'mid' | 'optimistic' | null;
  risks: RiskItem[];
  hard_soft_ratio: HardSoftRatio;
  csi_divisions: CSIDivision[];
  ai_guesses: AIGuess[];
  ai_evidence: AIEvidence[];

  final_hard_cost: number | null;
  final_soft_cost: number | null;
  final_total_cost: number | null;
  final_cost_summary: CostSummaryRow[];

  uploaded_files: UploadedFile[];
  conversation_id: string | null;
  edit_history: EditHistoryEntry[];
  chat_messages: ChatMessage[];
  debug_messages: DebugMessage[];

  created_at: string;
  updated_at: string;
}

// ── Legacy types (kept for /history page compatibility) ──

export type LegacyMessage = {
  role: 'assistant' | 'user';
  content: string;
  attachments?: { name: string; size: number }[];
};

export type LegacyConversation = {
  id: string;
  title: string;
  timestamp: number;
  messages: LegacyMessage[];
  share_token?: string | null;
  stageSnapshots?: any[];
};
