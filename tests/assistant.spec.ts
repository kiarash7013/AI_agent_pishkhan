import { test, expect } from '@playwright/test';
import { defaultRequest } from '../src/lib/domain';

test('statement API uses persisted transactions and validates customer and range',async({request})=>{
 const response=await request.post('/api/statement',{data:defaultRequest});expect(response.status()).toBe(200);
 const data=await response.json();expect(data.transactions).toHaveLength(3);expect(data.closing).toBe(295000000);expect(data.source).toBe('demo');
 expect((await request.post('/api/statement',{data:{...defaultRequest,customerId:'11111111'}})).status()).toBe(404);
 expect((await request.post('/api/statement',{data:{...defaultRequest,end:'2026-01-01'}})).status()).toBe(400);
 const partial=await (await request.post('/api/statement',{data:{...defaultRequest,start:'2026-10-01',end:'2026-10-10'}})).json();expect(partial.opening).toBe(330000000);expect(partial.transactions).toHaveLength(1);expect(partial.closing).toBe(310000000);
 expect((await request.post('/api/statement',{headers:{'content-type':'application/json'},data:'{'})).status()).toBe(400);
});

test('full drawer flow, downloads, closing while loading, and history',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'باز کردن دستیار هوشمند'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).toHaveAccessibleName("دستیار هوشمند");await expect(dialog.getByText('سلام، خوش آمدید')).toBeVisible();
 await page.screenshot({path:'test-results/welcome-desktop.png'});
 await dialog.getByRole('button',{name:'دریافت صورت‌حساب با شماره مشتری و بازه زمانی'}).click();
 await expect(dialog.getByRole('combobox',{name:'حساب'})).toBeVisible();
 await page.screenshot({path:'test-results/form-desktop.png'});
 await dialog.getByRole('button',{name:'دریافت صورت‌حساب',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'توقف دریافت'}).first()).toBeVisible();
 await dialog.getByRole('button',{name:'بستن دستیار'}).click();
 await page.getByRole('button',{name:'باز کردن دستیار هوشمند'}).click();
 await expect(dialog.getByText('صورت‌حساب آماده است')).toBeVisible();
 await expect(dialog.locator('.closing')).toContainText('۲۹۵٬۰۰۰٬۰۰۰');
 await page.screenshot({path:'test-results/result-desktop.png'});
 const [excel]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'دریافت Excel'}).click()]);expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);await excel.saveAs('test-results/statement.xlsx');
 const [pdf]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'دریافت PDF'}).click()]);expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);await pdf.saveAs('test-results/statement.pdf');
 await dialog.getByRole('button',{name:'نموداری نمایش بده'}).click();await expect(dialog.locator('meter')).toHaveCount(2);
 await dialog.getByRole('button',{name:'تاریخچه گفتگوها'}).click();await expect(dialog.locator('.history-row')).toHaveCount(1);
 await dialog.getByRole('button',{name:'گفتگوی جدید'}).click();await expect(dialog.getByText('سلام، خوش آمدید')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'باز کردن دستیار هوشمند'})).toBeFocused();
 await page.reload();await page.getByRole('button',{name:'باز کردن دستیار هوشمند'}).click();await dialog.getByRole('button',{name:'تاریخچه گفتگوها'}).click();await expect(dialog.locator('.history-row')).toHaveCount(1);
 expect(errors).toEqual([]);
});

test('mobile, keyboard, cancel, failure and retry',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/');await page.getByRole('button',{name:'باز کردن دستیار هوشمند'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toHaveCSS('width','375px');await page.screenshot({path:'test-results/welcome-mobile.png'});
 await dialog.getByRole('textbox',{name:'درخواست شما'}).fill('صورت حساب مشتری 84839993');await page.keyboard.press('Enter');
 await dialog.getByRole('button',{name:'بازه دلخواه'}).click();await dialog.getByLabel('از تاریخ').fill('2026-10-01');await dialog.getByLabel('تا تاریخ').fill('2026-10-10');
 await page.route('**/api/statement',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'خطای آزمایشی دریافت'})}));
 await dialog.getByRole('button',{name:'دریافت صورت‌حساب',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('خطای آزمایشی');
 await page.unroute('**/api/statement');await dialog.getByRole('button',{name:'دریافت صورت‌حساب',exact:true}).click();await dialog.getByRole('button',{name:'توقف دریافت'}).first().click();await expect(dialog.getByText('صورت‌حساب آماده است')).toHaveCount(0);
 await dialog.getByRole('button',{name:'دریافت صورت‌حساب',exact:true}).click();await expect(dialog.getByText('صورت‌حساب آماده است')).toBeVisible();await expect(dialog.locator('.closing')).toContainText('۳۱۰٬۰۰۰٬۰۰۰');
 await page.screenshot({path:'test-results/result-mobile.png'});
 const dimensions=await dialog.evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});
