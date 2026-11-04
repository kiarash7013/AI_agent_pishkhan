import { test, expect } from '@playwright/test';

test('sidebar search handles Persian typing, empty results, and reset', async ({ page }) => {
 await page.goto('/');
 const menu=page.getByRole('navigation',{name:'منوی اصلی'});
 const search=page.getByRole('textbox',{name:'جستجوی منو'});
 await expect(menu.getByRole('button')).toHaveCount(10);
 await page.screenshot({path:'test-results/shell-desktop.png'});
 await search.fill('اجرايي');
 await expect(menu.getByRole('button')).toHaveCount(1);
 await expect(menu.getByRole('button')).toHaveText('پرونده اجرایی ثبتی');
 await search.fill('برون سپاری');
 await expect(menu.getByRole('button')).toHaveText('برون‌سپاری');
 await search.fill('وجود ندارد');
 await expect(menu.getByRole('status')).toHaveText('موردی پیدا نشد');
 await search.fill('دعاوی');
 await menu.getByRole('button',{name:'پرونده دعاوی'}).click();
 await expect(search).toHaveValue('');
 await expect(menu.getByRole('button')).toHaveCount(10);
 await menu.getByRole('button',{name:'اطلاعات پایه'}).hover();
 await page.screenshot({path:'test-results/shell-hover.png'});
 await expect(page.locator('.header-actions button')).toHaveCount(2);
});
