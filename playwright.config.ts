import { defineConfig } from '@playwright/test';
import { browserOptions, browserArgs } from './tests/e2e/browser';
export default defineConfig({
  testDir:'tests/e2e',timeout:45000,fullyParallel:false,workers:1,
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1600,height:1000},launchOptions:{...browserOptions,args:browserArgs}},
  reporter:'list',webServer:{command:'npm run dev',url:'http://127.0.0.1:4173/editor.html',reuseExistingServer:true},
});
