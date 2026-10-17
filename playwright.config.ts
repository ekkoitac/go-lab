import {defineConfig} from '@playwright/test';
// Dedicated ports and database keep regression runs away from the learner's service.
// Full-course traces contain thousands of SVG snapshots; opt in with --trace retain-on-failure.
const webPort=process.env.GO100_E2E_WEB_PORT??'14317',apiPort=process.env.GO100_E2E_API_PORT??'14318';
export default defineConfig({
 outputDir:process.env.GO100_E2E_OUTPUT_DIR??'test-results',
 testDir:'tests/browser',timeout:45000,expect:{timeout:10000},fullyParallel:false,workers:1,reporter:'list',
 use:{baseURL:`http://127.0.0.1:${webPort}`,channel:'chrome',trace:'off',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}}],
 webServer:{command:'npm run dev',url:`http://127.0.0.1:${webPort}`,reuseExistingServer:false,env:{GO100_VITE_CACHE_DIR:'node_modules/.vite-e2e-'+webPort,GO100_DATA_DIR:process.env.GO100_E2E_DATA_DIR??'.runtime/e2e-data',GO100_API_PORT:apiPort,GO100_WEB_PORT:webPort},timeout:120000}
});
