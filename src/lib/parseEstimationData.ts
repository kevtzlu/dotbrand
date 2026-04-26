import { Message, EstimationData } from "@/lib/legacy-types";

export function detectStageFromContent(content: string): { stage: string; label: string } | null {
    const stageLabels: Record<string, string> = {
        A: "Stage A — Project Brief",
        B: "Stage B — Scope Definition",
        C: "Stage C — System Selection",
        D: "Stage D — Quantity Takeoff",
        E: "Stage E — Monte Carlo Simulation",
        F: "Stage F — Final Report",
    };

    const match = content.match(/\bStage\s+([A-F])\b/i);
    if (match) {
        const stage = match[1].toUpperCase();
        return { stage, label: stageLabels[stage] ?? `Stage ${stage}` };
    }
    return null;
}

export function parseEstimationData(messages: Message[]): EstimationData | null {
    if (messages.length === 0) return null;

    const assistantMessages = messages.filter(m => m.role === "assistant");
    if (assistantMessages.length === 0) return null;

    // Use the last assistant message for content checks (last overall message may be from user)
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    const content = lastMsg.content;

    const allAssistantContent = assistantMessages
        .map(m => m.content)
        .join("\n");

    const p10Patterns = [
        /\bP10\b[^$\n]{0,15}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /\bP10[:\s=]+\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /OPTIMISTIC[^$\n]{0,20}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
    ];

    const p50Patterns = [
        /\bP50\b[^$\n]{0,15}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /\bP50[:\s=]+\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /MOST\s*LIKELY[^$\n]{0,20}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
    ];

    const p80Patterns = [
        /\bP80\b[^$\n]{0,15}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /\bP80[:\s=]+\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /CONSERVATIVE[^$\n]{0,20}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
    ];

    function tryPatterns(patterns: RegExp[], text: string): number | null {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const raw = match[1].replace(/,/g, "");
                const num = parseFloat(raw);
                return num < 10000 ? num * 1_000_000 : num;
            }
        }
        return null;
    }

    const p10 = tryPatterns(p10Patterns, allAssistantContent);
    const p50 = tryPatterns(p50Patterns, allAssistantContent);
    const p80 = tryPatterns(p80Patterns, allAssistantContent);

    const isMonteCarloOrStageE =
        allAssistantContent.includes("MONTE CARLO") ||
        allAssistantContent.includes("Stage E") ||
        allAssistantContent.includes("STAGE E") ||
        allAssistantContent.includes("monte carlo");

    const isMonteCarloComplete = /P50|Monte Carlo|ITERATIONS/i.test(content);

    const hasP10P50P80 =
        p50 !== null && p10 !== null && p80 !== null &&
        p50 > 0 && p10 > 0 && p80 > 0;

    const isStageEComplete = hasP10P50P80 || messages.some(m =>
        m.role === "assistant" && (
            m.content.includes("Stage E → COMPLETE") ||
            m.content.includes("Stage E: COMPLETE") ||
            m.content.includes("✅ Stage E complete") ||
            m.content.includes("stage e complete") ||
            (m.content.includes("STAGE E") && m.content.includes("COMPLETE"))
        )
    );

    if (!((p50 !== null || isMonteCarloComplete) && isStageEComplete && isMonteCarloOrStageE)) {
        return null;
    }

    const p50Final = p50 ?? 0;
    const p10Final = (p10 !== null && p10 > 0 && p10 < p50Final) ? p10 : p50Final * 0.85;
    const p80Final = (p80 !== null && p80 > p50Final) ? p80 : p50Final * 1.25;

    const gfaMatch = content.match(/(?:GFA|Area|Square Feet)[:\s]+([\d,]+)/i);
    const locationMatch = content.match(/Location[:\s]+([^\n]+)/i);
    const projectMatch = content.match(/Project[:\s]+([^\n]+)/i);

    const detectedStage = detectStageFromContent(content);
    const currentStage = (detectedStage?.stage === "F") ? "F" : "E";

    const newData: EstimationData = {
        projectName: projectMatch?.[1]?.trim(),
        location: locationMatch?.[1]?.trim(),
        gfa: gfaMatch?.[1]?.trim() ? `${gfaMatch[1]} SF` : undefined,
        p10: p10Final,
        p50: p50Final,
        p80: p80Final,
        chartType: "monte-carlo",
        timestamp: Date.now(),
        stage: currentStage,
    };

    // Histogram generation
    const mean = newData.p50;
    const stdDev = (newData.p80 - newData.p10) / 2.56 || p50Final * 0.1;
    const histogram = [];
    for (let i = -3; i <= 3; i += 0.5) {
        const c = mean + i * stdDev;
        histogram.push({
            cost: `$${Math.round(c / 1000000)}M`,
            frequency: Math.floor(Math.exp(-0.5 * i * i) * 100),
        });
    }
    newData.histogram = histogram;

    // Category Breakdown
    const coreMatch = content.match(/Core[^\d%]*(\d+)%/i);
    const mepMatch = content.match(/MEP[^\d%]*(\d+)%/i);
    const interiorMatch = content.match(/Interior[^\d%]*(\d+)%/i);
    const otherMatch = content.match(/Other[^\d%]*(\d+)%/i);

    const parsePct = (s: string | undefined) => (s ? parseFloat(s) : 0);

    if (coreMatch || mepMatch || interiorMatch) {
        newData.breakdown = [
            { name: "Core & Shell", value: p50Final * (parsePct(coreMatch?.[1]) / 100 || 0.4) },
            { name: "MEP", value: p50Final * (parsePct(mepMatch?.[1]) / 100 || 0.3) },
            { name: "Interior", value: p50Final * (parsePct(interiorMatch?.[1]) / 100 || 0.2) },
            { name: "Other", value: p50Final * (parsePct(otherMatch?.[1]) / 100 || 0.1) },
        ];
    } else {
        newData.breakdown = [
            { name: "Core & Shell", value: p50Final * 0.4 },
            { name: "MEP", value: p50Final * 0.3 },
            { name: "Interior", value: p50Final * 0.2 },
            { name: "Other", value: p50Final * 0.1 },
        ];
    }

    // Risk Drivers Extraction
    const risks: { title: string; description: string }[] = [];

    const stageEMessages = messages.filter(m =>
        m.role === "assistant" && (
            m.content.includes("Stage E → COMPLETE") ||
            m.content.includes("Stage E: COMPLETE") ||
            (m.content.includes("STAGE E") && m.content.includes("COMPLETE")) ||
            (m.content.includes("P50") && m.content.includes("P10") && m.content.includes("P80"))
        )
    );
    const riskSearchContent = stageEMessages.length > 0
        ? stageEMessages.map(m => m.content).join("\n")
        : allAssistantContent;

    const metadataFields = /^(project|location|gfa|area|building type|wage type|seismic|address|city|state|country|client|owner|architect|engineer|date|floor|stories|height|sqft|sf|sq\.?\s*ft)/i;

    const riskTableRegex = /\|(.+)\|.*\n\|(?:[\s-]*:?[\s-]*\|)+\n((?:\|.*\|\n?)+)/g;
    let rm;
    while ((rm = riskTableRegex.exec(riskSearchContent)) !== null) {
        const headerLine = rm[1];
        if (/project|location|gfa|building type|wage|seismic/i.test(headerLine)) continue;
        const rows = rm[2].trim().split("\n");
        rows.forEach((row: string) => {
            const cells = row.split("|").map((c: string) => c.trim()).filter(Boolean);
            if (cells.length >= 2) {
                const title = cells[0].replace(/^\*+|\*+$/g, "").trim();
                const description = cells.slice(1).join(" — ").replace(/^\*+|\*+$/g, "").trim();
                if (title && title.length > 2 && !metadataFields.test(title) && !/^[-:]+$/.test(title)) {
                    risks.push({ title, description });
                }
            }
        });
    }

    if (risks.length === 0) {
        const boldListRegex = /\*{1,2}([^*\n]{3,80})\*{1,2}[:\s—-]+([^\n]{5,200})/g;
        let bm;
        while ((bm = boldListRegex.exec(riskSearchContent)) !== null) {
            const title = bm[1].trim();
            const description = bm[2].trim();
            if (title && description && !metadataFields.test(title) && risks.length < 8) {
                risks.push({ title, description });
            }
        }
    }

    if (risks.length === 0) {
        const numberedRegex = /^\s*[-•*]?\s*\d*\.?\s*([^\n]{5,80})(?:[:\s—–-]+([^\n]{5,200}))?/gm;
        let nm;
        while ((nm = numberedRegex.exec(riskSearchContent)) !== null) {
            const title = nm[1].trim();
            const description = nm[2]?.trim() || "";
            if (title && !metadataFields.test(title) && risks.length < 8) {
                risks.push({ title, description });
            }
        }
    }

    if (risks.length > 0) newData.risks = risks;

    return newData;
}
