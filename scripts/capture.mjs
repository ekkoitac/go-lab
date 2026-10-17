import {chromium} from '@playwright/test';import {mkdir} from 'node:fs/promises';
await mkdir('.runtime/screenshots',{recursive:true});const browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:4317/');await page.getByRole('heading',{name:/写得出来/}).waitFor();await page.screenshot({path:'.runtime/screenshots/home.png',fullPage:true});
await page.goto('http://127.0.0.1:4317/#lesson/14');await page.getByRole('button',{name:'动手观察',exact:true}).click();await page.getByTestId('live-model').waitFor();await page.screenshot({path:'.runtime/screenshots/lesson.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4317/');await page.getByRole('heading',{name:/写得出来/}).waitFor();await page.screenshot({path:'.runtime/screenshots/mobile.png',fullPage:true});await browser.close();console.log('Captured home, lesson and mobile');
