const fs = require('fs');
const path = require('path');

const BASE_DIR = '/Users/kevin/Downloads/dotbrand-estimait-5/';

const filesToTest = [
    'Config/KNOWLEDGE_PROMPT_REGISTRY_v4.7.yaml',
    'Data/GEOTECHNICAL_COST_DRIVER_MATRIX_v1.0.yaml',
    'Data/RENOVATION_COST_FACTOR_MATRIX_v1.1.yaml',
    'Knowledge Prompts/Layer 0/dotbrand ESTIMAIT 2 - SYSTEM INSTRUCTION PROMPT v2.2.md',
    'Knowledge Prompts/Layer 1/LAYER 1_ CORE ESTIMATION ENGINE v2.5.md',
    'Knowledge Prompts/Layer 1/knowledge_prompts_router_v2.3.py',
    'Knowledge Prompts/Layer 2/Commercial/LAYER 2_ COMMERCIAL CASE DATABASE v1.0.md',
    'Knowledge Prompts/Layer 2/Commercial/LAYER 2_ COMMERCIAL DECISION MATRIX v1.1.md',
    'Knowledge Prompts/Layer 2/Commercial/LAYER 2_ COMMERCIAL KNOWLEDGE PROMPT v1.0.md',
    'Knowledge Prompts/Layer 2/Healthcare/LAYER 2_ HEALTHCARE CASE DATABASE v1.0.md',
    'Knowledge Prompts/Layer 2/Healthcare/LAYER 2_ HEALTHCARE KNOWLEDGE PROMPT v1.2.md',
    'Knowledge Prompts/Layer 2/Healthcare/LAYER 2_ HEALTHCARE RENOVATION DECISION MATRIX v1.0.md',
    'Knowledge Prompts/Layer 2/Warehouse/LAYER 2_ WAREHOUSE DECISION MATRIX v1.0.md',
    'Knowledge Prompts/Layer 2/Warehouse/LAYER 2_WAREHOUSE KNOWLEDGE PROMPT v1.2.md',
    'Knowledge Prompts/Layer 2/Warehouse/LAYER2_WAREHOUSE_COST_DATABASE_v1.0.md',
    'Knowledge Prompts/Layer 3/LAYER 3.1_ CASE FEATURE EXTRACTION v1.1 (PRODUCTION).md',
    'Knowledge Prompts/Layer 3/LAYER 3.2_ CASE SIMILARITY MATCHING v1.0 (PRODUCTION).md',
    'Knowledge Prompts/Layer 3/LAYER 3.3_ CASE ADJUSTMENT FACTORS v1.2 (PRODUCTION).md',
    'Knowledge Prompts/Layer 3/LAYER 3.4_ CASE-BASED ESTIMATION LOGIC v1.1 (PRODUCTION).md',
    'Knowledge Prompts/Layer 3/LAYER 3.5_ GC DOUBLE CHECK PROTOCOL v1.1 (PRODUCTION).md',
    'Knowledge Prompts/Layer 3/LAYER3_CASE_DATABASE_v1.1_PRODUCTION.yaml',
    'Knowledge Prompts/GC Specific/GC_SPECIFIC_UPRITE_GENERAL_v3.0.md',
    'References/HEALTHCARE_INTEGRATION_ANALYSIS_v1.0_PRODUCTION.md'
];

console.log('--- KNOWLEDGE BASE INTEGRITY CHECK ---');

filesToTest.forEach(file => {
    const fullPath = path.join(BASE_DIR, file);
    if (fs.existsSync(fullPath)) {
        try {
            const stats = fs.statSync(fullPath);
            console.log(`✅ LOADED: ${file} (${stats.size} bytes)`);
        } catch (err) {
            console.log(`❌ ERROR READING: ${file} (${err.message})`);
        }
    } else {
        console.log(`❌ MISSING: ${file}`);
    }
});

// California Real Price List check
const refDir = path.join(BASE_DIR, 'References');
if (fs.existsSync(refDir)) {
    const refFiles = fs.readdirSync(refDir);
    const priceListFiles = refFiles.filter(f => f.toLowerCase().includes('california_real_price_list'));
    if (priceListFiles.length > 0) {
        priceListFiles.forEach(f => {
            const fullPath = path.join(refDir, f);
            const stats = fs.statSync(fullPath);
            console.log(`✅ FOUND Price List: References/${f} (${stats.size} bytes)`);
        });
    } else {
        console.log(`❌ MISSING Price List: Could not find "California Real Price List" in References folder`);
    }
} else {
    console.log(`❌ MISSING: References folder not found`);
}

console.log('--- CHECK COMPLETE ---');
