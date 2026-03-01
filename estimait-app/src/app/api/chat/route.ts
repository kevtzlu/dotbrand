import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import path from "path";
import {
    getKnowledgeRegistry,
    readKnowledgeFile,
    readKnowledgeFileAsync,
    getRawRegistryContent,
    getRegistrySummary,
    SYSTEM_PROMPT_CHAR_LIMIT,
    PRIMARY_SYSTEM_PROMPT,
    HARDCODED_LAYER1_PATH,
    UPRITE_KNOWLEDGE,
    detectBuildingType,
    detectDeliveryMethod,
    shouldLoadRenovationMatrix,
    shouldLoadPriceList
} from "@/lib/knowledge";
import { OfficeParser } from "officeparser";
import * as XLSX from "xlsx";

// Initialize the Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || "", // Ensure you set this in .env.local
});

// Initialize Supabase client for RAG
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getGCProfile(userId: string) {
    try {
        const { data, error } = await supabase
            .from("gc_profiles")
            .select("company_name, company_address, contingency_rate, gc_fee_rate, logo_url")
            .eq("clerk_user_id", userId)
            .single();
        if (error || !data) return null;
        return data;
    } catch (e) {
        return null;
    }
}

// RAG: Search relevant chunks for the user's question
async function searchRelevantChunks(query: string, conversationId: string): Promise<string> {
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: query,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        const { data, error } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            conversation_id_filter: conversationId,
            match_count: 8,
        });

        if (error || !data || data.length === 0) return '';

        const context = data
            .map((chunk: any) => `[${chunk.file_name} - chunk ${chunk.chunk_index}]\n${chunk.content}`)
            .join('\n\n---\n\n');

        console.log(`[RAG] Found ${data.length} relevant chunks`);
        return context;
    } catch (e) {
        console.error('[RAG] Search error:', e);
        return '';
    }
}

// RAG: Get ALL chunks for a conversation (used during Stage A document analysis)
async function getAllChunks(conversationId: string): Promise<string> {
    try {
        const { data, error } = await supabase
            .from('document_chunks')
            .select('file_name, chunk_index, content')
            .eq('conversation_id', conversationId)
            .order('chunk_index', { ascending: true });

        if (error || !data || data.length === 0) return '';

        const context = data
            .map((chunk: any) => `[${chunk.file_name} - chunk ${chunk.chunk_index}]\n${chunk.content}`)
            .join('\n\n---\n\n');

        console.log(`[RAG] Stage A: loaded ALL ${data.length} chunks`);
        return context;
    } catch (e) {
        console.error('[RAG] getAllChunks error:', e);
        return '';
    }
}

// Configure the route for large file handling and long durations
export const maxDuration = 300; // 5 minutes (max for Vercel Hobby/Pro)

// Helper for retry with backoff
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 3000): Promise<T> {
    try {
        return await fn();
    } catch (e: any) {
        if (e.status === 429 && retries > 0) {
            console.log(`[API] Rate limit hit (429). Retrying in ${delay}ms... (${retries} left)`);
            await new Promise(r => setTimeout(r, delay));
            return callWithRetry(fn, retries - 1, delay * 2);
        }
        throw e;
    }
}

export async function POST(req: Request) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 290000); // Trigger abort slightly before 300s limit

    try {
        const formData = await req.formData();
        const message = formData.get("message") as string;
        const historyJson = formData.get("history") as string | undefined;
        const buildingType = formData.get("buildingType") as string | undefined;
        // Support both raw file uploads (legacy) and blob URLs (new Vercel Blob flow)
        const files = formData.getAll("files") as File[];
        const blobUrlsJson = formData.get("blobUrls") as string | undefined;
        const blobUrls: { url: string; name: string; size: number }[] = blobUrlsJson ? JSON.parse(blobUrlsJson) : [];
        const conversationId = formData.get('conversationId') as string || 'default';

        // Load GC Profile
        const { userId } = await auth();
        let gcProfile = null;
        if (userId) {
            gcProfile = await getGCProfile(userId);
        }

        console.log(`[API] Received: ${files.length} files, ${blobUrls.length} blobUrls, message: "${message?.slice(0,50)}"`);

        const historyRaw = historyJson ? JSON.parse(historyJson) : [];

        // RAG: Search relevant chunks
        let ragContext = '';
        try {
            const isStageA = !historyRaw || historyRaw.length === 0 || 
                !historyRaw.some((m: any) => m.role === 'assistant' && m.content.includes('Stage B'));
            
            if (isStageA) {
                // Stage A: load all chunks but cap at 200,000 chars to leave room for knowledge prompts
                const allChunks = await getAllChunks(conversationId);
                const MAX_RAG_CHARS = 200000;
                ragContext = allChunks;
                if (ragContext.length > MAX_RAG_CHARS) {
                    ragContext = ragContext.substring(0, MAX_RAG_CHARS) + '\n\n[RAG context truncated to fit system prompt budget]';
                }
                if (!ragContext) {
                    // Fallback to semantic search if no chunks yet
                    ragContext = await searchRelevantChunks(message || 'project overview', conversationId);
                }
            } else {
                ragContext = await searchRelevantChunks(message || 'project overview', conversationId);
            }
            if (ragContext) {
                console.log(`[RAG] Injecting ${ragContext.length} chars of context`);
            }
        } catch (e) {
            console.error('[RAG] Search failed (non-fatal):', e);
        }

        // 1. History Truncation (Last 6 messages)
        let history = historyRaw.slice(-6);

        // 2. Token Estimation Pre-check
        let estimatedTokens = JSON.stringify(history).length / 4;
        if (estimatedTokens > 20000) {
            console.log(`[API] High token count detected (~${estimatedTokens}). Truncating further.`);
            history = history.slice(-4); // Keep even fewer if very large
        }

        const combinedTextForDetection = (message + " " + history.map((m: any) => m.content).join(" ")).toLowerCase();


        // 1. Get Registry
        const registry = getKnowledgeRegistry();
        let systemPromptFragments: string[] = [];
        let verificationToolsFragments: string[] = [];

        // --- HARDCODED PRIMARY SYSTEM PROMPT (LAYER 0) ---
        // This is now loaded once at startup in knowledge.ts
        if (PRIMARY_SYSTEM_PROMPT) {
            systemPromptFragments.push(`--- PRIMARY SYSTEM INSTRUCTIONS ---\n${PRIMARY_SYSTEM_PROMPT}`);
        } else {
            console.error(`[API] CRITICAL ERROR: PRIMARY_SYSTEM_PROMPT is empty!`);
        }

        // --- Dynamic Knowledge Injection Strategy ---

        // LAYER 0: System Instruction (Registry fallback - skip if already loaded)
        const layer0 = registry?.LAYER0?.[0];
        if (layer0?.local_path && layer0.local_path !== "dotbrand ESTIMAIT 2 - SYSTEM INSTRUCTION PROMPT v2.2 (PRODUCTION).md") {
            const content = readKnowledgeFile(layer0.local_path);
            if (content) systemPromptFragments.push(`--- LAYER 0: System Instruction (Registry) ---\n${content}`);
        }

        // LAYER 1: Core Methodology (Always include)
        const layer1Content = await readKnowledgeFileAsync(HARDCODED_LAYER1_PATH);
        if (layer1Content) {
            systemPromptFragments.push(`--- LAYER 1: Core Methodology ---\n${layer1Content}`);
            console.log(`[API] Layer 1 Engine loaded successfully.`);
        } else {
            // Fallback to registry if hardcoded fails
            const layer1Reg = registry?.LAYER1?.CORE_ENGINE?.[0];
            if (layer1Reg?.local_path) {
                const content = await readKnowledgeFileAsync(layer1Reg.local_path);
                if (content) systemPromptFragments.push(`--- LAYER 1: Core Methodology (Registry) ---\n${content}`);
            }
        }

        // RENOVATION MATRIX (Lazy Load)
        if (shouldLoadRenovationMatrix(combinedTextForDetection)) {
            const renovationMatrixPath = path.join(process.cwd(), "Data", "RENOVATION_COST_FACTOR_MATRIX_v1.1.yaml");
            const renovationContent = await readKnowledgeFileAsync(renovationMatrixPath);
            if (renovationContent) {
                systemPromptFragments.push(`--- DATA: Renovation Cost Factor Matrix ---\n${renovationContent}`);
                console.log(`[API] Renovation Matrix lazily loaded.`);
            }
        }

        // CALIFORNIA REAL PRICE LIST (Lazy Load)
        if (shouldLoadPriceList(combinedTextForDetection)) {
            const priceListPath = path.join(process.cwd(), "References", "ESTIMAIT_California_Real_Price_List_v1.0.md.docx");
            const priceListContent = await readKnowledgeFileAsync(priceListPath);
            if (priceListContent) {
                systemPromptFragments.push(`--- REFERENCE: California Real Price List 2025 ---\n${priceListContent}`);
                console.log(`[API] California Price List lazily loaded.`);
            }
        }

        // CA Estimation Formula Updates (always load)
        const formulaUpdatesPath = path.join(process.cwd(), "References", "CA_Estimation_Formula_Updates_v1.0.md");
        const formulaUpdatesContent = await readKnowledgeFileAsync(formulaUpdatesPath);
        if (formulaUpdatesContent) {
            systemPromptFragments.push(`--- CA ESTIMATION FORMULA UPDATES (MANDATORY) ---\n${formulaUpdatesContent}`);
            console.log(`[API] CA Formula Updates loaded.`);
        }

        // Multi-State Cost Rates (always load)
        const multiStateRatesPath = path.join(process.cwd(), "References", "MULTI_STATE_COST_RATES_v1.0.md");
        const multiStateRatesContent = await readKnowledgeFileAsync(multiStateRatesPath);
        if (multiStateRatesContent) {
            systemPromptFragments.push(`--- MULTI-STATE COST RATES (MANDATORY) ---\n${multiStateRatesContent}`);
            console.log(`[API] Multi-State Cost Rates loaded.`);
        }

        // LAYER 2: Domain Specific Knowledge (Lazy Load)
        const detectedBuildingType = buildingType || detectBuildingType(combinedTextForDetection);
        const deliveryMethod = detectDeliveryMethod(combinedTextForDetection);
        const isPublicWorks = deliveryMethod === "PUBLIC_WORKS_DBB";

        // Two-layer logic: civil + public works → PUBLIC_WORKS layer
        // civil + private → CIVIL layer (future)
        // other building types → their respective layers
        const finalBuildingType = (detectedBuildingType === "CIVIL" && isPublicWorks)
            ? "PUBLIC_WORKS"
            : detectedBuildingType;

        // Detect project delivery method
        const isDesignBidBuild = combinedTextForDetection.includes("design bid build") ||
            combinedTextForDetection.includes("design-bid-build") ||
            combinedTextForDetection.includes("dbb") ||
            combinedTextForDetection.includes("bid build") ||
            combinedTextForDetection.includes("complete drawings") ||
            combinedTextForDetection.includes("100% cd") ||
            combinedTextForDetection.includes("construction documents");

        const isShellBuilding = combinedTextForDetection.includes("shell") ||
            combinedTextForDetection.includes("core and shell") ||
            combinedTextForDetection.includes("shell only");

        const deliveryMethodContext = isDesignBidBuild
            ? "PROJECT DELIVERY: Design-Bid-Build confirmed. ENFORCE Scope Checklist + Drawing Checklist before Stage B."
            : isShellBuilding
                ? "PROJECT TYPE: Shell Building detected. ENFORCE Shell Scope Confirmation before estimating."
                : "PROJECT DELIVERY: Not yet confirmed. Ask GC in Stage A.";
        const isBeyondStageA = history.some((m: any) => m.role === 'assistant' && (m.content.includes("✅ Stage A complete") || m.content.includes("Stage B:")));

        if (finalBuildingType) {
            const typeKey = finalBuildingType.toUpperCase(); // WAREHOUSE, HEALTHCARE, COMMERCIAL
            const layer2Domain = registry?.LAYER2?.[typeKey];

            if (layer2Domain) {
                // Inject Condensed Knowledge Summary (instead of full config)
                const kb = layer2Domain.KNOWLEDGE?.[0];
                if (kb?.local_path) {
                    const kbContent = readKnowledgeFile(kb.local_path);
                    if (kbContent) {
                        // Create a condensed summary (first 2000 chars + message to user)
                        const summary = kbContent.slice(0, 2000);
                        systemPromptFragments.push(`--- LAYER 2: ${typeKey} Knowledge (SUMMARY) ---\n${summary}\n[NOTE: Full configuration available for deep queries.]`);
                    }
                }

                // Decision Matrix: only include key parameters
                const matrix = layer2Domain.DECISION_MATRIX?.[0];
                if (matrix?.local_path) {
                    const matrixContent = readKnowledgeFile(matrix.local_path);
                    if (matrixContent) {
                        const summary = matrixContent.slice(0, 1500);
                        systemPromptFragments.push(`--- LAYER 2: ${typeKey} Matrix (SUMMARY) ---\n${summary}`);
                    }
                }
                console.log(`[API] Layer 2: ${typeKey} domain summary injected.`);
                systemPromptFragments.push(`--- PROJECT DELIVERY CONTEXT ---\n${deliveryMethodContext}`);
            }
        }

        if (finalBuildingType) {
            const typeKey = finalBuildingType.toUpperCase();
            if (typeKey === "LAB") {
                const labChecklistPrompt = `
--- CLEANROOM / LAB CLASSIFICATION GATE ---
⛔ THIS PROJECT HAS BEEN IDENTIFIED AS LAB/CLEANROOM. YOU MUST CONFIRM:
1. ISO Class (5/6/7/8)?
2. FFU (Fan Filter Units) needed?
3. DI Water system needed?
4. Pre-Action Fire Suppression?
5. Wall system: Modular Panels vs GWB?
6. Flooring: ESD Epoxy vs Standard?
7. HVAC: New MAU vs Retrofit?

--- MANDATORY QUESTIONS (LAB/CLEANROOM) ---
□ PRECISE Schedule (weeks)?
□ Hard Deadline?
□ OFE (Owner Furnished Equipment) List?
□ GC Installation of OFE included?
□ Contingency: Included in Bid or Owner-held?
□ Roof / Site Work / Low Voltage in scope?

⛔ DO NOT APPLY CLEANROOM PREMIUMS UNTIL CLASSIFICATION IS CONFIRMED.
`;
                systemPromptFragments.push(labChecklistPrompt);
                console.log(`[API] Lab/Cleanroom classification gate injected.`);
            }
        }

        if (!finalBuildingType) {
            systemPromptFragments.push(`--- PROJECT DELIVERY CONTEXT ---\n${deliveryMethodContext}`);
        }

        if (isShellBuilding || isDesignBidBuild) {
            const shellChecklistPrompt = `
--- MANDATORY CHECKLIST ENFORCEMENT ---
This project requires the following confirmations BEFORE any cost calculation:

SCOPE CHECKLIST (ask GC to confirm each):
□ SOG / Slab on Grade: in GC scope OR "by others" per structural drawings?
□ HVAC Equipment: GC scope OR Owner/TI furnished?
□ Exterior cladding: which systems are included? (Stucco / ACM / Metal Panels / Stone)
□ Canopies: included or excluded?
□ Low voltage systems: included or excluded?
□ Fire Alarm: Design-Build by GC or Owner furnished?
□ Site Work boundary: what is included? (Civil plans required)
□ Missed Items: Have I included Surveying ($20K) and Temp Fence ($12K)?
□ Estimate purpose: Owner budget (→8% fee) OR GC competitive bid (→5% fee)?
□ Precision Grade: Have I declared the grade (Detailed ±10% vs Order of Magnitude ±30%)?
□ Structural Gate: Any new steel, footings, roof work, or shoring?

DRAWING CHECKLIST (AI must self-verify):
□ Have I read the Sheet Index and confirmed Civil Drawings (C1xx) are present?
□ Have I read elevation drawings and identified ALL exterior cladding materials?
□ Have I checked structural General Notes for "by others" keywords?
□ Have I confirmed glazing area from actual elevation dimensions (not % GFA)?
□ Have I checked MEP drawings for "by owner" or "TI" notations?

⛔ DO NOT PROCEED TO COST CALCULATION UNTIL PRECISION GRADE IS DECLARED & STRUCTURAL GATE IS CONFIRMED
`;
            systemPromptFragments.push(shellChecklistPrompt);
            console.log(`[API] Shell/DBB checklist injected.`);
        }

        // LAYER 3: Verification Tools (Lazy Load - only after Stage A)
        if (isBeyondStageA) {
            const layer3Features = registry?.LAYER3?.CASE_FEATURE_EXTRACTION?.[0];
            if (layer3Features?.local_path) {
                const featureContent = readKnowledgeFile(layer3Features.local_path);
                if (featureContent) verificationToolsFragments.push(`--- LAYER 3: Feature Extraction ---\n${featureContent}`);
            }
        }

        // CASE DATABASE GUARD: Prevent AI from using case data as direct cost output
        const caseDbGuard = `
== CASE DATABASE USAGE RULES (MANDATORY) ==
The case database contains historical project data for CALIBRATION ONLY.
NEVER output case database cost figures directly as the estimate for the current project.
ALWAYS re-derive costs using: GFA × unit cost rates × applicable multipliers.
Case data may only be used to:
1. Validate that your calculated unit costs are within reasonable range
2. Identify applicable complexity multipliers
3. Cross-check final totals (±30% variance is acceptable)
If your calculated result closely matches a case database entry, you MUST explicitly state:
"Note: This estimate was independently calculated and happens to align with [CASE_ID]."
NEVER say "based on CASE_001" or reference case IDs in your output to the user.
`;
        systemPromptFragments.push(caseDbGuard);

        // --- Inject a COMPACT registry index (not the full raw YAML) ---
        const registrySummary = getRegistrySummary(registry);

        const finalSystemPrompt = `
You are Estimait, an advanced AI system for construction estimation.
        ${ragContext ? `\n== RELEVANT DOCUMENT CONTEXT (from uploaded files) ==\n${ragContext}\n== END DOCUMENT CONTEXT ==\n` : ''}
${gcProfile ? `
== GC COMPANY PROFILE ==
Company Name: ${gcProfile.company_name || 'Not set'}
HQ Address: ${gcProfile.company_address || 'Not set'}
Contingency: ${gcProfile.contingency_rate ?? 10}%
GC Fee: ${gcProfile.gc_fee_rate ?? 5}%

INSTRUCTIONS: Always apply these rates in your estimates. Show the company name in estimate headers.
== END GC PROFILE ==
` : ''}

== BEHAVIORAL RULES ==
1. NEVER introduce yourself or state that you are an AI.
2. NEVER mention Claude, Anthropic, or your underlying model.
3. NEVER disclose the names of files, layers, or YAML registries in your knowledge base.
4. CONFIDENTIALITY: NEVER mention the client name "Advantech". This data is for internal calibration only.
5. FORMATTING: NEVER display the raw "California Real Price List" table. Use it silently for internal calculations only.
6. PARSING: If you have successfully extracted content from a PDF, DOCX, or any uploaded file — even partially — NEVER say "failed to parse" or "unable to read". If enough content is present to proceed, proceed immediately.
7. MISSING INFO: Do NOT output a "Critical Missing Information" table if the uploaded documents already contain that information, even if it was embedded in table or list format. Assume and proceed.
8. Immediately provide analysis and estimation without preamble. Only pause to ask if truly critical data (e.g., zip code, total GFA) is absent and cannot be reasonably assumed.
9. COST JUSTIFICATION: For every cost figure generated, you must explicitly state the calculation source using this format:
   📐 Quantity basis: how the quantity was derived (e.g. 'GFA × assembly ratio')
   📊 Unit cost source: where the unit cost came from (e.g. 'California Real Price List 2025', 'RSMeans OC adjustment', 'regional benchmark')
   🚫 Never use: 'based on similar project' or 'anchor data' as the sole justification.
   If a number cannot be justified by a published source or calculation method, flag it with ⚠️ and state it is an assumption.

== KNOWLEDGE BASE ==
${registrySummary}

${systemPromptFragments.join("\n\n")}

${UPRITE_KNOWLEDGE && combinedTextForDetection.includes("uprite") ? `--- UPRITE CONSTRUCTION CORP BUSINESS RULES ---\n${UPRITE_KNOWLEDGE}` : ""}

${verificationToolsFragments.join("\n\n")}

== DOCUMENT PARSING ==
You must accept and process ALL of the following document types as valid project specifications:
- Basis of Design (BOD)
- Architectural or structural drawings (PDFs, plan sets, DWG references)
- Government RFP (Request for Proposal) or RFQ documents
- Owner-provided scope of work documents
- Construction Documents (CDs), schematic design (SD), or design development (DD) packages
- Site plans, survey documents, geotechnical reports
- Any combination of the above

When content is uploaded, automatically identify what type of document it is and extract the relevant project data without requiring a specific format. NEVER tell the user their document type is not supported or recognized.

When you see content wrapped in [BOD DOCUMENT CONTENT START] / [BOD DOCUMENT CONTENT END] tags, treat it as the official project specification. Extract ALL project data from it directly — name, location, GFA, floors, occupancy, systems, and schedule. NEVER say information is missing if it exists within these tags.

IMPORTANT: The same files from the original upload are included with EVERY message. This means you always have access to the full project documents regardless of which stage of the workflow you are in. Never say you have lost access to uploaded files.

== AUTOMATED ESTIMATION WORKFLOW ==
⛔ WORKFLOW ENFORCEMENT: You MUST follow Stage A → B → C → D → E → F in sequence.
NEVER skip stages. NEVER output cost estimates before Stage D.
If you find yourself writing dollar amounts before the user has confirmed Stage C, STOP and return to the correct stage.
Stage A is MANDATORY even if documents are complete. It exists to confirm data with the user.

When the user uploads a Basis of Design (BOD), site maps, or any project documents, run Stage A immediately. After EACH stage, you MUST stop and present a summary checkpoint before proceeding.

CONFIRMATION RULE: After completing every stage, perform the following:
1. Provide a numbered list summarizing key data points from the stage.
2. List any assumptions made that require user verification.
3. Ask specific yes/no or fill-in questions for each listed assumption.
4. END with exactly this prompt (substituting the correct stage letter/number):
"Reply with any corrections, or type **confirm** to proceed to Stage [X+1]."

Do NOT proceed to the next stage until the user types "confirm" or an equivalent affirmation.

Stage A: PROJECT SUMMARY

**DOCUMENT-FIRST RULE (MANDATORY):**
Before asking ANY questions, you MUST:
1. Scan ALL uploaded documents thoroughly
2. Auto-populate every field you can find from the documents
3. ONLY ask questions for fields that are GENUINELY missing — not found anywhere in the uploaded files
4. If a field is found in the document, NEVER ask about it again
5. Present a summary table showing: [Field] | [Value Found] | [Source Document]
6. Then ask ONLY the truly missing fields in a single consolidated question block

DO NOT ask questions whose answers already exist in the uploaded documents.

- Summarize the uploaded BOD/documents: project name, location (zip code), building type, total GFA (sf), number of floors, occupancy class, target completion date.
- If any critical value is missing and cannot be assumed, note it once briefly — do not repeat.
- END with: A numbered summary of project specs, assumptions about location/codes, and a request to confirm/adjust before Stage B.

Stage B: SYSTEMS ASSESSMENT
- Evaluate and recommend: structural system (steel, concrete, tilt-up, wood frame), MEP systems (HVAC type, plumbing scope, electrical service), envelope and cladding, based on building size, occupancy, and zip code climate zone.
- State key assumptions clearly.
- END with: A numbered summary of selected systems, assumptions about MEP/Structural loads, and a request to confirm/adjust before Stage C.

Stage C: SITE METRICS
- Calculate site coverage ratio, FAR (Floor Area Ratio), parking requirements, and ADA compliance scope based on provided site area and local zoning assumptions.
- END with: A numbered summary of site metrics, assumptions about local zoning/parking stall sizes, and a request to confirm/adjust before Stage D-1.

Stage D-1: QUANTITY TAKEOFF — HQ BUILDING
- Calculate estimated quantities ONLY for the HQ building: materials (concrete, steel, framing, roofing, glazing), labor hours by trade, equipment/plant, and soft costs (A/E fees, permits, contingency, testing & inspection).
- Base quantities on HQ GFA and systems selected in Stage B.
- Present results in a table organized by CSI division.
- END with: A numbered summary of HQ quantities, assumptions about material waste factors, and a request to confirm/adjust before Stage D-2.

Stage D-2: QUANTITY TAKEOFF — AASC BUILDING + COMBINED SUMMARY
- Calculate estimated quantities for the AASC building with the same breakdown as D-1.
- Then provide a combined summary table showing HQ + AASC totals side-by-side.
- END with: A numbered summary of AASC quantities, combined totals, and a request to confirm/adjust before Stage E.

Stage E: MONTE CARLO SIMULATION
- Apply triangular distribution to cost components using ±15% optimistic/pessimistic variance.
- Output: P10 (Optimistic), P50 (Most Likely), P80 (Conservative) total project costs.
- Show breakdown by major cost category at P50.
- END with: A numbered summary of P10/P50/P80 values, assumptions about cost variance, and a request to confirm/adjust before Stage F.

Stage F: FINAL RECOMMENDATION
- Present final cost recommendation with confidence range.
- Include full Division breakdown (hard costs: Division 03–16, soft costs: Division 00–01).
- List RISK_DRIVERS: top 3–5 risks that could shift cost significantly, with mitigation notes.
- State data currency date and recommend when to re-run if timeline shifts beyond 90 days.
- END with: "✅ Estimation complete. Full report is ready. Let me know if you need any adjustments or a PDF export."

== CURRENT STAGE STEERING ==
${(() => {
                if (!history || history.length === 0) return "Starting session. Begin with Stage A.";
                // Find the last assistant message that mentions a stage completion
                const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant');
                if (!lastAssistantMsg) return "Starting session. Begin with Stage A.";

                if (lastAssistantMsg.content.includes("✅ Stage A complete")) return "The user confirmed Stage A. You MUST now proceed to Stage B.";
                if (lastAssistantMsg.content.includes("✅ Stage B complete")) return "The user confirmed Stage B. You MUST now proceed to Stage C.";
                if (lastAssistantMsg.content.includes("✅ Stage C complete")) return "The user confirmed Stage C. You MUST now proceed to Stage D-1.";
                if (lastAssistantMsg.content.includes("✅ Stage D-1 complete")) return "The user confirmed Stage D-1. You MUST now proceed to Stage D-2.";
                if (lastAssistantMsg.content.includes("✅ Stage D-2 complete")) return "The user confirmed Stage D-2. You MUST now proceed to Stage E.";
                if (lastAssistantMsg.content.includes("✅ Stage E complete")) return "The user confirmed Stage E. You MUST now proceed to Stage F.";

                return "Continue the conversation based on the history above.";
            })()}
    `;

        // Hard cap: if system prompt exceeds 150k tokens (~600k chars), truncate intelligently
        const cappedSystemPrompt = finalSystemPrompt.length > SYSTEM_PROMPT_CHAR_LIMIT
            ? finalSystemPrompt.slice(0, SYSTEM_PROMPT_CHAR_LIMIT) +
            "\n\n[SYSTEM: Prompt was truncated to fit within token limits. Use injected context above.]"
            : finalSystemPrompt;

        console.log(`[API] System prompt length: ${finalSystemPrompt.length} chars (cap: ${SYSTEM_PROMPT_CHAR_LIMIT})`, finalSystemPrompt.length > SYSTEM_PROMPT_CHAR_LIMIT ? '⚠️ TRUNCATED' : '✅ OK');

        // Parse extracted files content
        let extractedDocumentContext = "";
        let contentBlocks: any[] = [];

        // Process files from Vercel Blob URLs (new flow)
        for (const blobFile of blobUrls) {
            console.log(`[API] Processing blobFile: ${blobFile.name} (${blobFile.url.slice(0, 60)}...)`);
            try {
                const response = await fetch(blobFile.url);
                if (!response.ok) {
                    console.error(`[API] Failed to fetch blob: ${blobFile.url}`);
                    continue;
                }
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const ext = blobFile.name.slice(blobFile.name.lastIndexOf('.')).toLowerCase();
                let text = "";

                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    const MAX_IMAGE_BYTES = 5_000_000; // ~5MB limit (Claude Vision API maximum)
                    if (buffer.byteLength > MAX_IMAGE_BYTES) {
                        console.warn(`[Image] ${blobFile.name} too large (${buffer.byteLength} bytes), skipping.`);
                        extractedDocumentContext += `\nNote: Image ${blobFile.name} was too large and was skipped.\n`;
                        continue;
                    }
                    const mediaType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                    contentBlocks.push({
                        type: "image",
                        source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") }
                    });
                    console.log(`[Image] Added to contentBlocks: ${blobFile.name}`);
                    continue;
                } else if (ext === '.pdf') {
                    // PDF content is handled via RAG (see searchRelevantChunks above).
                    // We do NOT inject the raw PDF into the Claude message to avoid token limits.
                    console.log(`[PDF] ${blobFile.name}: skipping direct injection — content available via RAG context.`);
                    contentBlocks.push({
                        type: "text",
                        text: `[Attached Files: ${blobFile.name} — content retrieved via semantic search and injected above.]`
                    });
                    continue;
                } else if (ext === '.docx') {
                    const mammoth = require("mammoth");
                    const result = await mammoth.extractRawText({ buffer });
                    text = result.value;
                } else if (ext === '.pptx') {
                    const ast = await OfficeParser.parseOffice(buffer);
                    text = ast.toText();
                } else if (ext === '.xlsx' || ext === '.xls') {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    for (const sheetName of workbook.SheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const csv = XLSX.utils.sheet_to_csv(sheet);
                        if (csv.trim()) text += `\n--- SHEET: ${sheetName} ---\n${csv}\n`;
                    }
                } else if (['.txt', '.md', '.yaml', '.json', '.csv', '.py'].includes(ext)) {
                    text = buffer.toString('utf8');
                }

                if (text.trim()) {
                    const PER_FILE_CHAR_LIMIT = 40_000;
                    const cappedText = text.length > PER_FILE_CHAR_LIMIT
                        ? text.slice(0, PER_FILE_CHAR_LIMIT) + `\n[... File truncated at 10,000 tokens. Original: ${text.length} chars ...]`
                        : text;
                    extractedDocumentContext += `\n[BOD DOCUMENT CONTENT START: ${blobFile.name}]\n${cappedText.trim()}\n[BOD DOCUMENT CONTENT END: ${blobFile.name}]\n`;
                }
            } catch (err: any) {
                console.error(`Failed to process blob file ${blobFile.name}:`, err);
                extractedDocumentContext += `\n[NOTE: Failed to parse content of ${blobFile.name} due to an error: ${err.message}]\n`;
            }
        }

        // Process raw file uploads (legacy/local flow)
        for (const f of files) {
            try {
                const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                const arrayBuffer = await f.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                let text = "";

                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                    // Images → Claude Vision
                    const MAX_IMAGE_BYTES = 5_000_000; // ~5MB limit (Claude Vision API maximum)
                    if (buffer.byteLength > MAX_IMAGE_BYTES) {
                        console.warn(`[Image] ${f.name} too large (${buffer.byteLength} bytes), skipping.`);
                        extractedDocumentContext += `\nNote: Image ${f.name} was too large and was skipped.\n`;
                        continue;
                    }
                    const mediaType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                    contentBlocks.push({
                        type: "image",
                        source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") }
                    });
                    console.log(`[Image] Added to contentBlocks: ${f.name}`);
                    continue;
                } else if (ext === '.pdf') {
                    // PDF content is handled via RAG (see searchRelevantChunks above).
                    // We do NOT inject the raw PDF into the Claude message to avoid token limits.
                    console.log(`[PDF] ${f.name}: skipping direct injection — content available via RAG context.`);
                    contentBlocks.push({
                        type: "text",
                        text: `[Attached Files: ${f.name} — content retrieved via semantic search and injected above.]`
                    });
                    continue;
                }
                else if (ext === '.docx') {
                    const mammoth = require("mammoth");
                    const result = await mammoth.extractRawText({ buffer });
                    text = result.value;
                } else if (ext === '.pptx') {
                    const ast = await OfficeParser.parseOffice(buffer);
                    text = ast.toText();
                } else if (ext === '.xlsx' || ext === '.xls') {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    for (const sheetName of workbook.SheetNames) {
                        const sheet = workbook.Sheets[sheetName];
                        const csv = XLSX.utils.sheet_to_csv(sheet);
                        if (csv.trim()) {
                            text += `\n--- SHEET: ${sheetName} ---\n${csv}\n`;
                        }
                    }
                } else if (['.txt', '.md', '.yaml', '.json', '.csv', '.py'].includes(ext)) {
                    text = buffer.toString('utf8');
                }

                if (text.trim()) {
                    // Per-file 10K token cap (40k chars) for user attachments
                    const PER_FILE_CHAR_LIMIT = 40_000;
                    const cappedText = text.length > PER_FILE_CHAR_LIMIT
                        ? text.slice(0, PER_FILE_CHAR_LIMIT) + `\n[... File truncated at 10,000 tokens. Original: ${text.length} chars ...]`
                        : text;
                    extractedDocumentContext += `\n[BOD DOCUMENT CONTENT START: ${f.name}]\n${cappedText.trim()}\n[BOD DOCUMENT CONTENT END: ${f.name}]\n`;
                }
            } catch (err: any) {
                console.error(`Failed to parse file ${f.name}:`, err);
                extractedDocumentContext += `\n[NOTE: Failed to parse content of ${f.name} due to an error: ${err.message}]\n`;
            }
        }

        let finalUserMessage = message;
        if (extractedDocumentContext.trim()) {
            finalUserMessage += `\n\n[USER PROVIDED ATTACHMENTS FOR ANALYSIS]\n${extractedDocumentContext}\n`;
        }

        // Budget control: limit total content blocks size
        const MAX_TOTAL_CONTENT_CHARS = 600_000; // ~150k tokens budget for user content
        let totalContentChars = 0;
        const budgetedContentBlocks: any[] = [];

        for (const block of contentBlocks) {
            let blockSize = 0;
            if (block.type === 'text') {
                blockSize = block.text?.length || 0;
            } else if (block.type === 'document') {
                blockSize = block.source?.data?.length || 0;
            } else if (block.type === 'image') {
                blockSize = block.source?.data?.length || 0;
            }

            if (totalContentChars + blockSize > MAX_TOTAL_CONTENT_CHARS) {
                console.warn(`[API] Budget exceeded at block type=${block.type} size=${blockSize}. Total so far=${totalContentChars}. Skipping.`);
                continue;
            }
            totalContentChars += blockSize;
            budgetedContentBlocks.push(block);
        }
        console.log(`[API] Content budget used: ${totalContentChars} / ${MAX_TOTAL_CONTENT_CHARS} chars across ${budgetedContentBlocks.length} blocks`);

        // Replace contentBlocks with budgeted version
        const filteredContentBlocks = budgetedContentBlocks;

        // Fallback: if all PDF blocks were skipped (oversized), add a text notice so the message is still valid
        if (filteredContentBlocks.length === 0 && (blobUrls.length > 0 || files.length > 0)) {
            console.warn("[API] All file blocks were skipped (oversized or unsupported). Sending text-only fallback.");
            filteredContentBlocks.push({
                type: "text",
                text: "[NOTE: All uploaded files were skipped because they exceeded size limits after truncation. Please ask the user to upload a smaller version or split the document.]"
            });
        }

        const userTextBlock = finalUserMessage.trim()
            ? [{ type: "text", text: finalUserMessage }]
            : [];

        const currentUserMessage = {
            role: "user",
            content: [
                ...userTextBlock,
                ...filteredContentBlocks
            ]
        };

        console.log(`[API] currentUserMessage content blocks: ${JSON.stringify(currentUserMessage.content?.map((b: any) => ({ type: b.type, len: b.type === 'text' ? b.text?.length : b.source?.data?.length })))}`);

        // Construct the full message history for Claude
        const anthropicMessages = [
            ...history
                .filter((m: any) => {
                    const c = m.content;
                    const hasContent = c && (typeof c === 'string' ? c.trim().length > 0 : Array.isArray(c) ? c.length > 0 : false);
                    if (!hasContent) console.warn(`[API] Filtered empty history message: role=${m.role}`);
                    return hasContent;
                })
                .map((m: any) => ({ role: m.role, content: m.content })),
            currentUserMessage
        ];

        // 2. Call Claude with streaming & retry
        const stream: any = await callWithRetry(async () => {
            return anthropic.messages.stream({
                model: "claude-sonnet-4-6",
                max_tokens: 8192,
                system: cappedSystemPrompt,
                messages: anthropicMessages as any[],
                temperature: 0.1,
            }, { signal: controller.signal });
        });

        // Return a Server-Sent Events (SSE) stream
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(readableController) {
                try {
                    for await (const chunk of stream) {
                        if (
                            chunk.type === 'content_block_delta' &&
                            chunk.delta.type === 'text_delta'
                        ) {
                            const data = JSON.stringify({ type: 'delta', text: chunk.delta.text });
                            readableController.enqueue(encoder.encode(`data: ${data}\n\n`));
                        }
                    }
                    // Send done event
                    readableController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                } catch (err: any) {
                    const errData = JSON.stringify({ type: 'error', error: err.message });
                    readableController.enqueue(encoder.encode(`data: ${errData}\n\n`));
                } finally {
                    readableController.close();
                    clearTimeout(timeoutId);
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
