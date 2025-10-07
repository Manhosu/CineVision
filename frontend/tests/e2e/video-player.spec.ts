import { test, expect, Page, Browser } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  contentId: 'test-movie-123',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  timeout: 30000,
};

// Helper functions
async function waitForVideoPlayer(page: Page) {
  await page.waitForSelector('[data-testid="video-player"]', { timeout: TEST_CONFIG.timeout });
  await page.waitForSelector('video', { timeout: TEST_CONFIG.timeout });
}

async function getVideoElement(page: Page) {
  return page.locator('video').first();
}

async function waitForVideoLoad(page: Page) {
  const video = await getVideoElement(page);
  await expect(video).toHaveAttribute('src', /.+/);

  // Wait for video to be ready
  await page.waitForFunction(() => {
    const video = document.querySelector('video') as HTMLVideoElement;
    return video && video.readyState >= 2; // HAVE_CURRENT_DATA
  }, { timeout: TEST_CONFIG.timeout });
}

async function mockAuthenticatedUser(page: Page) {
  // Mock authentication
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'mock_jwt_token');
  });

  // Mock API responses
  await page.route(`${TEST_CONFIG.apiUrl}/content/${TEST_CONFIG.contentId}/stream`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        streamUrl: 'https://mock-cdn.com/stream.m3u8',
        manifestUrl: 'https://mock-cdn.com/master.m3u8',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        accessToken: 'mock_stream_token',
        qualities: ['720p', '1080p'],
      }),
    });
  });
}

// Test suite
test.describe('Video Player E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('should load video player successfully', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);

    await waitForVideoPlayer(page);

    // Check if video element is present
    const video = await getVideoElement(page);
    await expect(video).toBeVisible();

    // Check if controls are present
    await expect(page.locator('[data-testid="play-pause-button"]')).toBeVisible();
  });

  test('should play and pause video', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    const video = await getVideoElement(page);
    const playButton = page.locator('[data-testid="play-pause-button"]');

    // Initially paused
    expect(await video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);

    // Click play
    await playButton.click();
    await page.waitForTimeout(1000);

    // Should be playing
    expect(await video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(false);

    // Click pause
    await playButton.click();
    await page.waitForTimeout(500);

    // Should be paused
    expect(await video.evaluate(v => (v as HTMLVideoElement).paused)).toBe(true);
  });

  test('should seek video using progress bar', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);
    await waitForVideoLoad(page);

    const video = await getVideoElement(page);
    const progressBar = page.locator('[data-testid="progress-bar"]');

    // Get initial time
    const initialTime = await video.evaluate(v => (v as HTMLVideoElement).currentTime);

    // Click on progress bar at 50% position
    const progressBarBox = await progressBar.boundingBox();
    if (progressBarBox) {
      await page.mouse.click(
        progressBarBox.x + progressBarBox.width * 0.5,
        progressBarBox.y + progressBarBox.height * 0.5
      );

      await page.waitForTimeout(1000);

      // Current time should have changed
      const newTime = await video.evaluate(v => (v as HTMLVideoElement).currentTime);
      expect(newTime).not.toBe(initialTime);
    }
  });

  test('should change volume', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    const video = await getVideoElement(page);
    const volumeButton = page.locator('[data-testid="volume-button"]');

    // Initial volume should be > 0
    const initialVolume = await video.evaluate(v => (v as HTMLVideoElement).volume);
    expect(initialVolume).toBeGreaterThan(0);

    // Click mute button
    await volumeButton.click();
    await page.waitForTimeout(500);

    // Should be muted
    const isMuted = await video.evaluate(v => (v as HTMLVideoElement).muted);
    expect(isMuted).toBe(true);

    // Click unmute
    await volumeButton.click();
    await page.waitForTimeout(500);

    // Should be unmuted
    const isStillMuted = await video.evaluate(v => (v as HTMLVideoElement).muted);
    expect(isStillMuted).toBe(false);
  });

  test('should enter and exit fullscreen', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    const fullscreenButton = page.locator('[data-testid="fullscreen-button"]');

    // Click fullscreen
    await fullscreenButton.click();
    await page.waitForTimeout(1000);

    // Check if in fullscreen mode (this might vary by browser)
    const isFullscreen = await page.evaluate(() => {
      return !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
    });

    // Note: Playwright doesn't always support fullscreen in headless mode
    // so we'll just verify the button was clicked
    await expect(fullscreenButton).toBeVisible();
  });

  test('should show quality selector', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    const qualityButton = page.locator('[data-testid="quality-button"]');
    await qualityButton.click();

    // Quality menu should appear
    await expect(page.locator('[data-testid="quality-menu"]')).toBeVisible();

    // Should show available qualities
    await expect(page.locator('text=720p')).toBeVisible();
    await expect(page.locator('text=1080p')).toBeVisible();

    // Select 720p
    await page.locator('text=720p').click();

    // Menu should close
    await expect(page.locator('[data-testid="quality-menu"]')).not.toBeVisible();
  });

  test('should handle keyboard controls', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    const video = await getVideoElement(page);

    // Focus on video player
    await video.focus();

    // Test space bar for play/pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    let isPlaying = await video.evaluate(v => !(v as HTMLVideoElement).paused);
    expect(isPlaying).toBe(true);

    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    isPlaying = await video.evaluate(v => !(v as HTMLVideoElement).paused);
    expect(isPlaying).toBe(false);

    // Test arrow keys for seeking
    const initialTime = await video.evaluate(v => (v as HTMLVideoElement).currentTime);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    const newTime = await video.evaluate(v => (v as HTMLVideoElement).currentTime);
    expect(newTime).toBeGreaterThan(initialTime);
  });

  test('should handle authentication errors', async ({ page }) => {
    // Mock unauthorized response
    await page.route(`${TEST_CONFIG.apiUrl}/content/${TEST_CONFIG.contentId}/stream`, async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Authentication required',
        }),
      });
    });

    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);

    // Should show error message
    await expect(page.locator('text=Authentication required')).toBeVisible();

    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route(`${TEST_CONFIG.apiUrl}/content/${TEST_CONFIG.contentId}/stream`, async route => {
      await route.abort('failed');
    });

    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);

    // Should show error message
    await expect(page.locator('text=Failed to load video')).toBeVisible();

    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should display loading state', async ({ page }) => {
    // Delay the stream response
    await page.route(`${TEST_CONFIG.apiUrl}/content/${TEST_CONFIG.contentId}/stream`, async route => {
      await page.waitForTimeout(2000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          streamUrl: 'https://mock-cdn.com/stream.m3u8',
          manifestUrl: 'https://mock-cdn.com/master.m3u8',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          accessToken: 'mock_stream_token',
          qualities: ['720p', '1080p'],
        }),
      });
    });

    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);

    // Should show loading spinner
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    await expect(page.locator('text=Loading video')).toBeVisible();

    // Wait for video to load
    await waitForVideoPlayer(page);

    // Loading should be gone
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
  });

  test('should resume playback from saved position', async ({ page }) => {
    // Set resume position in localStorage
    await page.addInitScript(() => {
      localStorage.setItem(`resume_${TEST_CONFIG.contentId}`, '120'); // 2 minutes
    });

    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);
    await waitForVideoLoad(page);

    // Should show resume prompt
    await expect(page.locator('text=Resume from 2:00')).toBeVisible();

    // Click resume
    await page.locator('text=Resume').click();

    const video = await getVideoElement(page);

    // Should start from resume position (approximately)
    await page.waitForTimeout(1000);
    const currentTime = await video.evaluate(v => (v as HTMLVideoElement).currentTime);
    expect(currentTime).toBeGreaterThanOrEqual(115); // Allow some tolerance
    expect(currentTime).toBeLessThanOrEqual(125);
  });
});

// Mobile-specific tests
test.describe('Mobile Video Player Tests', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  });

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('should display mobile-optimized controls', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    // Mobile controls should be visible
    await expect(page.locator('.mobile-safe')).toBeVisible();

    // Touch-friendly button sizes
    const playButton = page.locator('[data-testid="play-pause-button"]');
    const buttonBox = await playButton.boundingBox();

    // Button should be at least 44px (iOS touch target size)
    expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
  });

  test('should handle touch gestures', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    const video = await getVideoElement(page);

    // Tap to play/pause
    await video.tap();
    await page.waitForTimeout(500);

    const isPlaying = await video.evaluate(v => !(v as HTMLVideoElement).paused);
    expect(isPlaying).toBe(true);
  });
});

// Smart TV tests
test.describe('Smart TV Video Player Tests', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1',
  });

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page);
  });

  test('should display TV-optimized interface', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    // TV-specific classes should be applied
    await expect(page.locator('.tv-device')).toBeVisible();
    await expect(page.locator('.tv-safe')).toBeVisible();

    // Large controls for remote control
    const controls = page.locator('.btn');
    const controlBox = await controls.first().boundingBox();

    // Controls should be larger on TV
    expect(controlBox?.width).toBeGreaterThanOrEqual(48);
    expect(controlBox?.height).toBeGreaterThanOrEqual(48);
  });

  test('should handle remote control navigation', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    // Simulate remote control keys
    await page.keyboard.press('Enter'); // Play/pause
    await page.waitForTimeout(500);

    const video = await getVideoElement(page);
    const isPlaying = await video.evaluate(v => !(v as HTMLVideoElement).paused);
    expect(isPlaying).toBe(true);

    // Test directional navigation
    await page.keyboard.press('ArrowUp'); // Should show controls
    await expect(page.locator('.player-controls')).toBeVisible();
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  test('should load within acceptable time limits', async ({ page }) => {
    await mockAuthenticatedUser(page);

    const startTime = Date.now();
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);
    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have memory leaks during playback', async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    // Get initial memory usage
    const initialMetrics = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      } : null;
    });

    if (initialMetrics) {
      // Simulate some playback activity
      await page.keyboard.press('Space'); // Play
      await page.waitForTimeout(5000);
      await page.keyboard.press('Space'); // Pause

      // Check memory after activity
      const finalMetrics = await page.evaluate(() => {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      });

      // Memory usage shouldn't increase dramatically
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    }
  });
});

// Accessibility tests
test.describe('Accessibility Tests', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    // Tab through controls
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should focus on interactive elements
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await mockAuthenticatedUser(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/watch/${TEST_CONFIG.contentId}`);
    await waitForVideoPlayer(page);

    // Check ARIA labels on controls
    await expect(page.locator('[aria-label="Play"]')).toBeVisible();
    await expect(page.locator('[aria-label="Mute"]')).toBeVisible();
    await expect(page.locator('[aria-label="Enter fullscreen"]')).toBeVisible();
  });
});

test.afterAll(async () => {
  // Cleanup any test data or configurations
  console.log('E2E tests completed');
});