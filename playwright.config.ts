import { defineConfig } from '@playwright/test';
import { browserOptions, browserArgs, testBaseUrl, testPort } from './tests/e2e/browser';
export default defineConfig({
  testDir:'tests/e2e',timeout:45000,fullyParallel:false,workers:1,
  use:{baseURL:testBaseUrl,viewport:{width:1600,height:1000},launchOptions:{...browserOptions,args:browserArgs}},
  reporter:'list',webServer:{command:`npm run dev -- --port ${testPort} --strictPort`,url:testBaseUrl+'/editor.html',reuseExistingServer:true},
});
