// ── Project Data Model (V2) ──

export type ProjectStatus = 'uploading' | 'overview' | 'detail' | 'final' | 'completed';

export type ContractType = 'design_build' | 'design_bid_build';

export interface BidFormLineItem {
  item_no: string;
  description: string;
  qty?: number | null;
  unit: string;
  notes?: string;
}

export interface BidFormSection {
  section_title: string;
  items: BidFormLineItem[];
}

export interface BidFormStructure {
  found: boolean;
  title?: string;
  sections: BidFormSection[];
}

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
  /** Snapshot of PW setting when overview estimate was produced. */
  prevailing_wage?: boolean;
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
  ai_gc_actions?: string;
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
  estimating_error: string | null;

  // Contract metadata
  contract_type: ContractType | null;
  prevailing_wage: boolean;
  bid_form_items: BidFormSection[] | null;

  // Bid tracking
  bid_award_date: string | null;
  construction_start_date: string | null;
  bid_result: 'won' | 'lost' | null;
  bid_followup_dismissed: boolean;
  loss_reason: string | null;
  kb_project_id: string | null;

  created_at: string;
  updated_at: string;
}

export const ESTIMATION_STALE_MS = 800 * 1000; // ~13 minutes (matches serverless maxDuration)

// ── Knowledge Base ──

export type KnowledgeProjectType = 'public' | 'private';

export type KnowledgeDocSlot =
  | 'doc_contract'
  | 'doc_design_drawings'
  | 'doc_specifications'
  | 'doc_site_info'
  | 'doc_estimating'
  | 'doc_owner_bid'
  | 'doc_field_reports'
  | 'doc_other_files';

export const KNOWLEDGE_DOC_SLOTS: {
  key: KnowledgeDocSlot;
  label: string;
  description: string;
  required: boolean;
}[] = [
  { key: 'doc_contract', label: 'Contract Documents', description: 'Contracts and agreements', required: false },
  { key: 'doc_design_drawings', label: 'Design Drawings', description: 'Blueprints and design plans', required: false },
  { key: 'doc_specifications', label: 'Specifications', description: 'Project specifications', required: false },
  { key: 'doc_site_info', label: 'Site Information', description: 'Site photos, maps, or location references', required: false },
  { key: 'doc_owner_bid', label: 'Owner Bid Documents', description: 'BOD, RFP, ITB, and other owner/client bid package files', required: true },
  { key: 'doc_estimating', label: 'Estimating Documents', description: 'GC bid estimates, takeoffs, and worksheets', required: true },
  { key: 'doc_field_reports', label: 'Field Reports', description: 'Daily reports, field logs, and site observations', required: false },
  { key: 'doc_other_files', label: 'Other Files', description: 'Any other reference files for this project', required: false },
];

/** Slots that must have at least one file for is_complete */
export const KNOWLEDGE_REQUIRED_DOC_SLOTS = KNOWLEDGE_DOC_SLOTS.filter((s) => s.required).map(
  (s) => s.key
) as Extract<KnowledgeDocSlot, 'doc_owner_bid' | 'doc_estimating'>[];

/** Normalize a doc slot value from DB (may be single object for old records, or array) */
export function toFileArray(val: UploadedFile | UploadedFile[] | null | undefined): UploadedFile[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

export function knowledgeSlotHasFiles(val: UploadedFile | UploadedFile[] | null | undefined): boolean {
  return toFileArray(val).length > 0;
}

export function computeKnowledgeIsComplete(
  docs: Partial<Record<KnowledgeDocSlot, unknown>>
): boolean {
  return KNOWLEDGE_REQUIRED_DOC_SLOTS.every((slot) =>
    knowledgeSlotHasFiles(docs[slot] as UploadedFile | UploadedFile[] | null | undefined)
  );
}

export interface KnowledgeProject {
  id: string;
  user_id: string;
  name: string;
  project_type: KnowledgeProjectType;
  start_date: string | null;
  end_date: string | null;
  prevailing_wage: boolean;

  contract_type?: 'design_build' | 'design_bid_build' | null;

  // Each slot stores an array of files (backward-compat: old records may have a single object)
  doc_contract: UploadedFile[] | UploadedFile | null;
  doc_design_drawings: UploadedFile[] | UploadedFile | null;
  doc_specifications: UploadedFile[] | UploadedFile | null;
  doc_site_info: UploadedFile[] | UploadedFile | null;
  doc_estimating: UploadedFile[] | UploadedFile | null;
  doc_owner_bid: UploadedFile[] | UploadedFile | null;
  doc_field_reports: UploadedFile[] | UploadedFile | null;
  doc_other_files: UploadedFile[] | UploadedFile | null;

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
