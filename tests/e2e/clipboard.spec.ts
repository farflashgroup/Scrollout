import { test, expect } from '@playwright/test';
import { seedClipboardScreenshot, verifyContextImagePaste } from './clipboard-fixture';
import fs from 'node:fs/promises';
import path from 'node:path';

test('right-click Copy image pastes the full edited crop rather than the viewport overlay',async({page})=>{
  await page.goto('/editor.html?capture=clipboard-regression');await seedClipboardScreenshot(page);await verifyContextImagePaste(page);
});

test('screenshot menu supports keyboard dismissal, outside clicks, scrolling, and narrow windows',async({page})=>{
  await page.goto('/editor.html?capture=clipboard-menu');await seedClipboardScreenshot(page);
  const canvas=page.getByTestId('editor-canvas'),menu=page.getByRole('menu',{name:'Screenshot actions'});
  await canvas.focus();await canvas.press('Shift+F10');await expect(page.getByRole('menuitem',{name:'Copy image',exact:true})).toBeFocused();
  await page.keyboard.press('Delete');await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(canvas).toBeFocused();
  await canvas.click({button:'right'});await page.getByLabel('Screenshot filename').click();await expect(menu).toHaveCount(0);await expect(page.getByLabel('Screenshot filename')).toBeFocused();
  await canvas.click({button:'right'});await page.locator('.viewport').evaluate(element=>{element.scrollTop=100});await expect(menu).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const box=(await canvas.boundingBox())!;await canvas.click({button:'right',position:{x:box.width-5,y:box.height-5}});await expect(menu).toBeVisible();
  const bounds=(await menu.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(8);expect(bounds.x+bounds.width).toBeLessThanOrEqual(382);expect(bounds.y+bounds.height).toBeLessThanOrEqual(836);
  if(process.env.SCROLLOUT_QA_EVIDENCE_DIR){await fs.mkdir(process.env.SCROLLOUT_QA_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCROLLOUT_QA_EVIDENCE_DIR,'clipboard-menu-mobile.png')})}
  await page.keyboard.press('Tab');await expect(menu).toHaveCount(0);
});
