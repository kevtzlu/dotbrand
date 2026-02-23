import fs from "fs"
import path from "path"
import yaml from "js-yaml"

// The base directory of the knowledge base is the parent of our Next.js app 
// inside the user's workspace
const KNOWLEDGE_BASE_DIR = path.resolve(process.cwd(), "..")

// Strict token budget constants
// 1 token ≈ 4 chars (conservative estimate for dense technical content)
const CHARS_PER_TOKEN = 4;
const MAX_TOKENS_PER_FILE = 10_000;                        // 10k tokens per file
const MAX_CHARS_PER_FILE = MAX_TOKENS_PER_FILE * CHARS_PER_TOKEN; // 40k chars
const MAX_TOTAL_SYSTEM_TOKENS = 80_000;                    // 80k total 
export const SYSTEM_PROMPT_CHAR_LIMIT = MAX_TOTAL_SYSTEM_TOKENS * CHARS_PER_TOKEN; // 320k chars

// --- HARDCODED CRITICAL PATHS ---
export const HARDCODED_LAYER0_PATH = "/Users/kevin/Downloads/dotbrand-estimait-5/Knowledge Prompts/Layer 0/dotbrand ESTIMAIT 2 - SYSTEM INSTRUCTION PROMPT v2.2.md";
export const HARDCODED_LAYER1_PATH = "/Users/kevin/Downloads/dotbrand-estimait-5/Knowledge Prompts/Layer 1/LAYER 1_ CORE ESTIMATION ENGINE v2.5.md";
export const HARDCODED_UPRITE_PATH = "/Users/kevin/Downloads/dotbrand-estimait-5/Knowledge Prompts/GC Specific/GC_SPECIFIC_UPRITE_GENERAL_v3.0.md";

// --- STARTUP LOADING (LAYER 0 & UPRITE) ---
let primaryPromptMemory: string = "";
let upriteKnowledgeMemory: string = "";

try {
    if (fs.existsSync(HARDCODED_LAYER0_PATH)) {
        primaryPromptMemory = fs.readFileSync(HARDCODED_LAYER0_PATH, 'utf8');
        console.log(`[System] INSTRUCTION PROMPT loaded: ${primaryPromptMemory.length} characters`);
    } else {
        throw new Error(`CRITICAL: Primary System Prompt NOT FOUND at ${HARDCODED_LAYER0_PATH}`);
    }

    if (fs.existsSync(HARDCODED_UPRITE_PATH)) {
        upriteKnowledgeMemory = fs.readFileSync(HARDCODED_UPRITE_PATH, 'utf8');
        console.log(`[API] UPRITE knowledge loaded: ${upriteKnowledgeMemory.length} characters`);
    } else {
        console.warn(`[System] UPRITE knowledge NOT FOUND at ${HARDCODED_UPRITE_PATH}`);
    }
} catch (err: any) {
    console.error(`[System] FAILED TO LOAD PRIMARY PROMPT: ${err.message}`);
    // In production/important dev environments, we want to stop if the heart of the system is missing
    throw new Error(`CRITICAL FAILURE: System cannot start without PRIMARY_SYSTEM_PROMPT. Check paths. ${err.message}`);
}

export const PRIMARY_SYSTEM_PROMPT = primaryPromptMemory;
export const UPRITE_KNOWLEDGE = upriteKnowledgeMemory;

/**
 * Detects project type from text content (user messages or history).
 */
export function detectBuildingType(text: string): string | null {
    const t = text.toLowerCase();
    if (t.includes("warehouse") || t.includes("logistic") || t.includes("distribution")) return "WAREHOUSE";
    if (t.includes("healthcare") || t.includes("hospital") || t.includes("clinic") || t.includes("medical")) return "HEALTHCARE";
    if (t.includes("commercial") || t.includes("office") || t.includes("retail") || t.includes("mixed-use")) return "COMMERCIAL";
    if (t.includes("lab") || t.includes("laboratory") || t.includes("cleanroom") || t.includes("pharmaceutical") || t.includes("semiconductor")) return "LAB";
    return null;
}

/**
 * Detects if the project involves renovation or existing structures.
 */
export function shouldLoadRenovationMatrix(text: string): boolean {
    const t = text.toLowerCase();
    return t.includes("renovation") || t.includes("existing") || t.includes("remodel") || t.includes("retrofit") || t.includes("tenant improvement") || t.includes(" ti ");
}

/**
 * Detects if the price list is needed based on the conversation stage or explicit cost queries.
 */
export function shouldLoadPriceList(text: string): boolean {
    const t = text.toLowerCase();
    // Load if in later stages or specifically asking about unit costs/pricing
    return t.includes("stage d") || t.includes("stage e") || t.includes("stage f") ||
        t.includes("unit cost") || t.includes("price") || t.includes("cost per") ||
        t.includes("takeoff") || t.includes("quantities");
}

/**
 * Helper to find the latest version of KNOWLEDGE_PROMPT_REGISTRY_*.yaml
 * Uses numeric version comparison so v4.10 > v4.9, etc.
 * Never throws on a version mismatch – always returns the highest available.
 */
function getLatestRegistryPath(): string {
    const configDir = path.join(KNOWLEDGE_BASE_DIR, "Config")
    if (!fs.existsSync(configDir)) {
        throw new Error(`Config directory not found at ${configDir}`)
    }

    const files = fs.readdirSync(configDir)
    const registryFiles = files.filter(f =>
        f.startsWith("KNOWLEDGE_PROMPT_REGISTRY_") && f.endsWith(".yaml")
    )

    if (registryFiles.length === 0) {
        throw new Error("No KNOWLEDGE_PROMPT_REGISTRY_*.yaml found in Config directory.")
    }

    // Numeric version sort descending (e.g., v4.7 → 4.7)
    registryFiles.sort((a, b) => {
        const extractVersion = (name: string): number => {
            const match = name.match(/v(\d+)[._](\d+)/i)
            return match ? parseFloat(`${match[1]}.${match[2]}`) : 0
        }
        return extractVersion(b) - extractVersion(a)
    })

    const chosen = registryFiles[0]
    console.log(`[Knowledge] Using registry: ${chosen}`)
    return path.join(configDir, chosen)
}

/**
 * Returns true if the path should be excluded (deprecated or non-existent).
 */
function isDeprecatedPath(p: string): boolean {
    return /deprecated/i.test(p)
}

/**
 * Resolves a Linux absolute path from the YAML registry to the local Mac workspace path.
 * Silently skips paths in any "Deprecated" folder hierarchy.
 * Uses FUZZY MATCHING to handle minor filename/version discrepancies.
 */
export function resolveLocalPath(linuxPath: string): string | null {
    if (isDeprecatedPath(linuxPath)) {
        return null // silently skip
    }

    const baseName = path.basename(linuxPath)

    const searchDirs = [
        "",
        "Knowledge Prompts",
        "Data",
        "Tools",
        "Config",
        "References"
    ].map(p => path.join(KNOWLEDGE_BASE_DIR, p))

    for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const foundPath = findFileFuzzy(dir, baseName);
        if (foundPath) return foundPath;
    }

    console.warn(`[Knowledge] Could not resolve local path for: ${baseName}`)
    return null
}

/**
 * Normalizes a filename for comparison: lowercase, remove spaces, underscores, and dots.
 */
function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[\s\._\-]/g, '')
}

/**
 * Strips version strings like v1.2 or _v1_2 to allow matching across minor updates.
 */
function stripVersion(name: string): string {
    return normalizeName(name).replace(/v\d+[\d\.]*/g, '')
}

/**
 * Normalizes name but keeps extension for better matching.
 */
function normalizeWithExt(name: string): string {
    const ext = path.extname(name)
    const base = path.basename(name, ext)
    return normalizeName(base) + ext.toLowerCase()
}

function findFileFuzzy(dir: string, targetName: string): string | null {
    const targetNorm = normalizeWithExt(targetName)
    const targetBaseNorm = normalizeName(path.basename(targetName, path.extname(targetName)))
    const targetNoVer = stripVersion(path.basename(targetName, path.extname(targetName)))

    // Collect all recursive files first
    const allFiles: string[] = []
    function collectFiles(currentDir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true })
        } catch { return }

        for (const entry of entries) {
            if (isDeprecatedPath(entry.name)) continue
            const fullPath = path.join(currentDir, entry.name)
            if (entry.isDirectory()) {
                collectFiles(fullPath)
            } else {
                allFiles.push(fullPath)
            }
        }
    }

    collectFiles(dir)

    // First pass: exact or normalized match
    for (const filePath of allFiles) {
        const fileName = path.basename(filePath)
        const entryNorm = normalizeWithExt(fileName)
        if (entryNorm === targetNorm) return filePath

        // Handle case where disk has .md.docx but registry says .md
        if (entryNorm.startsWith(targetBaseNorm) && fileName.toLowerCase().includes(targetBaseNorm)) {
            return filePath
        }
    }

    // Second pass: Version-agnostic match
    for (const filePath of allFiles) {
        const fileName = path.basename(filePath)
        const entryBase = path.basename(fileName, path.extname(fileName))
        const entryNoVer = stripVersion(entryBase)
        if (entryNoVer === targetNoVer && targetNoVer.length > 5) {
            return filePath
        }
    }

    // Third pass: Token-based similarity (handles "PROMPT" vs "PRODUCTION", etc.)
    const getTokens = (s: string) => {
        return s.toLowerCase()
            .replace(/v\d+[\d\.]*/g, '') // remove versions
            .split(/[\s\._\-]/)
            .filter(t => t.length > 2)   // only significant words
    }
    const targetTokens = getTokens(path.basename(targetName, path.extname(targetName)))

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath)
        const entryTokens = getTokens(path.basename(fileName, path.extname(fileName)))

        if (targetTokens.length === 0) continue;

        // Count how many target tokens exist in the entry
        let matchCount = 0;
        for (const tt of targetTokens) {
            if (entryTokens.some(et => et.includes(tt) || tt.includes(et))) {
                matchCount++;
            }
        }

        // If at least 70% of tokens match, we consider it a hit
        const score = matchCount / targetTokens.length;
        if (score >= 0.7) {
            return filePath
        }
    }

    return null
}

export interface InternalRegistryNode {
    name: string;
    file_path: string;
    status?: string;
    version?: string;
    description?: string;
    type?: string;
    local_path?: string;
}

/**
 * Loads and parses the latest KNOWLEDGE_PROMPT_REGISTRY_*.yaml.
 * Does NOT inject the raw YAML content into prompts — use getRegistrySummary() for a condensed index.
 */
export function getKnowledgeRegistry(): Record<string, any> {
    const registryPath = getLatestRegistryPath()
    let fileContents = fs.readFileSync(registryPath, 'utf8')

    let docs: any[];
    try {
        docs = yaml.loadAll(fileContents)
    } catch (e: any) {
        console.error("[Knowledge] YAML parsing error, attempting auto-fix...", e.message);
        fileContents = fileContents.replace(/\n\s{2,}(v[0-9]+_[0-9]+:)/g, '\n $1')
        docs = yaml.loadAll(fileContents)
    }

    const registry = docs.reduce((acc: any, doc: any) => ({ ...acc, ...doc }), {}) as Record<string, any>
    traverseAndMapPaths(registry)
    return registry
}

/**
 * Returns a SHORT structural summary of the registry (max ~2k chars).
 * This replaces the full raw YAML injection in the system prompt.
 */
export function getRegistrySummary(registry: Record<string, any>): string {
    const lines: string[] = ["[KNOWLEDGE INDEX]"]

    const walkLayer = (layerKey: string, obj: any, depth = 0) => {
        if (!obj || typeof obj !== 'object') return
        const indent = '  '.repeat(depth)
        if (Array.isArray(obj)) {
            obj.forEach((item: any) => {
                if (item?.name) lines.push(`${indent}- ${item.name}${item.status ? ` (${item.status})` : ''}`)
            })
        } else {
            for (const [key, val] of Object.entries(obj)) {
                if (['CHANGELOG', 'METADATA'].includes(key)) continue
                lines.push(`${indent}${key}:`)
                walkLayer(key, val, depth + 1)
            }
        }
    }

    walkLayer('REGISTRY', registry)
    return lines.slice(0, 80).join('\n') // hard limit to ~80 lines
}

/**
 * Reads a knowledge file with a strict 10k-token (40k chars) cap.
 * Supports .txt, .md, .yaml, and .docx via mammoth.
 * Returns truncated content with a summary note if over limit.
 */
export function readKnowledgeFile(localPath: string): string | null {
    if (!localPath || !fs.existsSync(localPath)) return null

    let raw = "";
    const ext = path.extname(localPath).toLowerCase();

    try {
        if (ext === '.docx') {
            const mammoth = require("mammoth");
            // Note: readKnowledgeFile is sync in many places, but mammoth is async.
            // However, this is usually called in the API route which is async.
            // For now, if called sync, it might fail. Let's make it smarter.
            return null; // We will handle docx separately in an async version or 
            // update the caller to handle the promise.
        } else {
            raw = fs.readFileSync(localPath, 'utf8')
        }
    } catch (err) {
        console.error(`[Knowledge] Failed to read ${localPath}:`, err);
        return null;
    }

    if (raw.length <= MAX_CHARS_PER_FILE) return raw

    // Truncate and note the cutoff
    const truncated = raw.slice(0, MAX_CHARS_PER_FILE)
    const lineCount = raw.split('\n').length
    console.warn(`[Knowledge] Truncated ${path.basename(localPath)}: ${raw.length} → ${MAX_CHARS_PER_FILE} chars (${lineCount} lines original)`)
    return `${truncated}\n\n[... Truncated at 10,000 tokens. Original: ~${lineCount} lines. Key parameters above are sufficient for estimation. ...]`
}

/**
 * Async version of readKnowledgeFile to handle .docx and .pdf correctly.
 */
export async function readKnowledgeFileAsync(localPath: string): Promise<string | null> {
    if (!localPath || !fs.existsSync(localPath)) return null

    const ext = path.extname(localPath).toLowerCase();
    const buffer = fs.readFileSync(localPath);

    try {
        if (ext === '.docx' || localPath.endsWith('.md.docx')) {
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (ext === '.pdf') {
            const pdf = require("pdf-parse");
            const data = await pdf(buffer);
            return data.text;
        } else {
            return buffer.toString('utf8');
        }
    } catch (err) {
        console.error(`[Knowledge] Failed to read async ${localPath}:`, err);
        return null;
    }
}

/**
 * Raw registry content getter — returns a very short index only (NOT full YAML).
 * @deprecated Use getRegistrySummary(registry) instead for new code.
 */
export function getRawRegistryContent(): string | null {
    try {
        const registry = getKnowledgeRegistry()
        return getRegistrySummary(registry)
    } catch (e) {
        console.error("[Knowledge] Failed to generate registry summary", e)
        return null
    }
}

function traverseAndMapPaths(obj: any) {
    if (Array.isArray(obj)) {
        obj.forEach(traverseAndMapPaths)
    } else if (typeof obj === 'object' && obj !== null) {
        if (obj.file_path && typeof obj.file_path === 'string') {
            obj.local_path = resolveLocalPath(obj.file_path)
        }
        for (const key in obj) {
            if (typeof obj[key] === 'object') {
                traverseAndMapPaths(obj[key])
            }
        }
    }
}
