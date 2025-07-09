import { beforeAll, afterAll, vi } from 'vitest';

beforeAll(() => {
	// WBGTデータの取得日を固定するためにDateをモック
	const mockDate = new Date('2025-07-09T00:00:00.000Z');
	vi.useFakeTimers();
	vi.setSystemTime(mockDate);
});

afterAll(() => {
	vi.useRealTimers();
});
