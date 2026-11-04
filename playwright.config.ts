import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',fullyParallel:false,workers:1,use:{baseURL:process.env.TEST_URL||'http://localhost:3000',viewport:{width:1440,height:1080},headless:true,launchOptions:process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}},reporter:'list',timeout:45000});
