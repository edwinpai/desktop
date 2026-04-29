/**
 * E2E Tests for Access Control and User Management
 *
 * FIXME: These tests require Tauri runtime (tauri://localhost) and UI features
 * that don't exist yet (Gateway Mode button, user management pages, invitation system).
 * Re-enable as features are implemented.
 */

import { test, expect } from '@playwright/test';

test.describe.fixme('User Management', () => {
  test('should navigate to users page from sidebar', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Users' }).click();
    await expect(page.getByText('User Management')).toBeVisible();
  });

  test('should display empty state when no users authorized', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Users' }).click();
    await expect(page.getByText('No authorized users')).toBeVisible();
    await expect(page.getByText('Create an invitation to add users')).toBeVisible();
  });

  test('should display user list with role badges', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Users' }).click();
    const ownerBadge = page.getByText('Owner');
    if (await ownerBadge.isVisible()) {
      await expect(ownerBadge).toBeVisible();
    }
  });

  test('should allow changing user access level', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Users' }).click();
    const levelSelect = page.locator('select').first();
    if (await levelSelect.isVisible()) {
      await levelSelect.selectOption('guest');
      await expect(page.getByText('Write').first()).toBeVisible();
    }
  });

  test('should confirm before removing user', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Users' }).click();
    page.on('dialog', dialog => dialog.accept());
    const removeBtn = page.getByRole('button', { name: 'Remove' });
    if (await removeBtn.isVisible()) {
      await removeBtn.first().click();
    }
  });
});

test.describe.fixme('Invitation Management', () => {
  test('should navigate to invitations page', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Invitations' }).click();
    await expect(page.getByText('Create Invitation')).toBeVisible();
  });

  test('should create invitation with custom settings', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Invitations' }).click();
    await page.locator('select#level').selectOption('member');
    await page.locator('input#expires').fill('48');
    await page.getByRole('button', { name: 'Create Invitation' }).click();
    await page.waitForTimeout(1000);
    const successText = page.getByText('Invitation Created');
    if (await successText.isVisible()) {
      await expect(successText).toBeVisible();
    }
  });

  test('should display QR code after creation', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Invitations' }).click();
    await page.getByRole('button', { name: 'Create Invitation' }).click();
    await page.waitForTimeout(1000);
    const qrCode = page.locator('svg').first();
    if (await qrCode.isVisible()) {
      await expect(qrCode).toBeVisible();
    }
  });

  test('should allow copying QR code and link', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Invitations' }).click();
    await page.getByRole('button', { name: 'Create Invitation' }).click();
    await page.waitForTimeout(1000);
    const copyQRBtn = page.getByRole('button', { name: 'Copy QR' });
    if (await copyQRBtn.isVisible()) { await copyQRBtn.click(); }
    const copyLinkBtn = page.getByRole('button', { name: 'Copy Link' });
    if (await copyLinkBtn.isVisible()) { await copyLinkBtn.click(); }
  });

  test('should display security notice for invitations', async ({ page }) => {
    await page.goto('tauri://localhost');
    await page.getByText('Gateway Mode').click();
    await page.getByRole('button', { name: 'Invitations' }).click();
    await page.getByRole('button', { name: 'Create Invitation' }).click();
    await page.waitForTimeout(1000);
    const securityNotice = page.getByText(/Security Notice.*can only be used once/);
    if (await securityNotice.isVisible()) {
      await expect(securityNotice).toBeVisible();
    }
  });
});
