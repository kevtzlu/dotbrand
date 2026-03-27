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
  data: string;  // base64 (empty when url is used)
  size: number;
  url?: string;  // R2 URL for large files
  ragConversationId?: string;  // set when large PDF was RAG-embedded instead of sent inline
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

  // Estimation progress tracking
  estimating_phase: 'overview' | 'detail' | 'final' | null;
  estimating_started_at: string | null;

  created_at: string;
  updated_at: string;
}

export const ESTIMATION_STALE_MS = 6 * 60 * 1000; // 6 minutes

// ── Knowledge Base ──

export type KnowledgeProjectType = 'public' | 'private';

export type KnowledgeDocSlot = 'doc_bod' | 'doc_google_maps' | 'doc_drawings' | 'doc_initial_est' | 'doc_final_est';

export const KNOWLEDGE_DOC_SLOTS: { key: KnowledgeDocSlot; label: string; description: string }[] = [
  { key: 'doc_bod', label: 'BOD / RFP', description: 'Basis of Design or Request for Proposal' },
  { key: 'doc_google_maps', label: 'Google Maps', description: 'Site screenshot, image, or link' },
  { key: 'doc_drawings', label: 'Engineering Drawings', description: 'Blueprints and plans' },
  { key: 'doc_initial_est', label: 'Initial Estimate', description: 'Excel or PDF estimate' },
  { key: 'doc_final_est', label: 'Final Estimate', description: 'Excel or PDF final estimate' },
];

export interface KnowledgeProject {
  id: string;
  user_id: string;
  name: string;
  project_type: KnowledgeProjectType;
  start_date: string | null;
  end_date: string | null;
  prevailing_wage: boolean;

  doc_bod: UploadedFile | null;
  doc_google_maps: UploadedFile | null;
  doc_drawings: UploadedFile | null;
  doc_initial_est: UploadedFile | null;
  doc_final_est: UploadedFile | null;

  is_complete: boolean;
  conversation_id: string;

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
