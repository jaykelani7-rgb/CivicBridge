import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:30000,use:{baseURL:'http://127.0.0.1:3102',trace:'retain-on-failure'},webServer:{command:'npm run preview:fixtures',url:'http://127.0.0.1:3102',reuseExistingServer:true},projects:[{name:'Fixture Chrome',use:{browserName:'chromium'}}]});
