import { resolveLocalPath } from './src/lib/knowledge';

const testPaths = [
    'LAYER1_CORE_ESTIMATION_ENGINE_v2.5.md',
    'RENOVATION_COST_FACTOR_MATRIX_v1.0.yaml',
    'LAYER2_WAREHOUSE_KNOWLEDGE_v1.2_PRODUCTION.md',
    'ESTIMAIT_California_Real_Price_List_v1.0.md'
];

console.log('--- Path Resolution Test ---');
testPaths.forEach(p => {
    const resolved = resolveLocalPath(p);
    console.log(`Input: ${p}`);
    console.log(`Resolved: ${resolved || '❌ FAILED'}`);
    console.log('---');
});
