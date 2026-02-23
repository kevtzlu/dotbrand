import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

// Lightweight in-process cache: key -> { data, expiresAt }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const memoryCache = new Map<string, { data: string; expiresAt: number }>();

function getCached(key: string): string | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { memoryCache.delete(key); return null; }
    return entry.data;
}

function setCache(key: string, data: string): void {
    memoryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

interface SearchRequest {
    query: string;
    targetSource?: 'RSMeans' | 'BLS' | 'ENR' | 'DIR' | 'GENERAL';
}

/**
 * Fallback scraping tool for Claude to retrieve numerical indices and local wages.
 * WARNING: Target sites must be public text without complex JS hydration barriers.
 */
export async function POST(req: Request) {
    try {
        const body: SearchRequest = await req.json();
        const { query, targetSource = 'GENERAL' } = body;

        if (!query) {
            return NextResponse.json({ error: "Missing search query" }, { status: 400 });
        }

        const cacheKey = `search_${targetSource}_${query.toLowerCase().replace(/\s+/g, '_')}`;
        const cachedResult = getCached(cacheKey);

        if (cachedResult) {
            console.log(`[Cache Hit] Returning 24h cached data for: ${query}`);
            return NextResponse.json({ success: true, data: cachedResult, source: "cache" });
        }

        console.log(`[Web Crawl] Executing live search for: ${query} on ${targetSource}`);

        // Construct a safe DDG search query enforcing target sites if requested
        let searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        if (targetSource === 'BLS') searchUrl += encodeURIComponent(' site:bls.gov');
        else if (targetSource === 'RSMeans') searchUrl += encodeURIComponent(' site:rsmeans.com');
        else if (targetSource === 'DIR') searchUrl += encodeURIComponent(' site:dir.ca.gov');
        else if (targetSource === 'ENR') searchUrl += encodeURIComponent(' site:enr.com');

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let extractedData: string[] = [];

        // DuckDuckGo HTML result snippets
        $('.result__snippet').each((i, element) => {
            if (i >= 5) return false; // Top 5 only
            const text = $(element).text().trim();
            // Only sentences with numbers, dates, or currency
            if (/(?:\$\d+|\d+%|\d{4}|\d+\.\d+)/.test(text)) {
                extractedData.push(text);
            }
        });

        const combinedResult = extractedData.length > 0
            ? extractedData.join('\n')
            : "No numerical construction data found for this query.";

        setCache(cacheKey, combinedResult);

        return NextResponse.json({ success: true, data: combinedResult, source: "live_crawl" });

    } catch (error: any) {
        console.error("Web crawl failed:", error.message);
        return NextResponse.json({
            success: false,
            error: "Failed to scrape live data. Will silently fallback to default KB.",
            details: error.message
        }, { status: 500 });
    }
}
