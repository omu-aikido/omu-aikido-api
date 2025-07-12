import { describe, it, expect, vi } from 'vitest';
import { fetchWbgtData, saveWbgtDataToKV, getWbgtDataFromKV, saveWbgt } from '../src/wbgt';

// 有効なレスポンスの例
const mockCsvResponse = `,,2025070903,2025070906,2025070909,2025070912,2025070915,2025070918,2025070921,2025070924,2025071003,2025071006,2025071009,2025071012,2025071015,2025071018,2025071021,2025071024,2025071103,2025071106,2025071109,2025071112,2025071115,2025071118,2025071121,2025071124
62091,2025/07/09 00:25, 250, 260, 290, 320, 300, 290, 280, 270, 250, 260, 300, 310, 290, 280, 280, 270, 260, 270, 290, 300, 290, 270, 260, 260
`;
describe('fetchWbgtData', () => {
	it('should fetch WBGT data and return WbgtEntry array', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValueOnce(
			new Response(mockCsvResponse, {
				headers: { 'Content-Type': 'text/csv' },
			})
		);

		const entries = await fetchWbgtData('62091');

		expect(entries).toEqual([
			{ key: 'WBGT_20250709_15', value: '30' },
			{ key: 'WBGT_20250709_18', value: '29' },
			{ key: 'WBGT_20250710_15', value: '29' },
			{ key: 'WBGT_20250710_18', value: '28' },
		]);
		expect(global.fetch).toHaveBeenCalledWith('https://www.wbgt.env.go.jp/prev15WG/dl/yohou_62091.csv');
	});

	it('should return empty array if fetch fails', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' }));

		const entries = await fetchWbgtData('62091');
		expect(entries).toEqual([]);
	});

	it('should return empty array if CSV data is too short', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('header\n', { headers: { 'Content-Type': 'text/csv' } }));

		const entries = await fetchWbgtData('62091');
		expect(entries).toEqual([]);
	});
});

describe('saveWbgtDataToKV', () => {
	it('should save WBGT data to KV if value differs', async () => {
		const mockKV = {
			put: vi.fn(),
			get: vi.fn(() => Promise.resolve('old_value')), // Mock existing value
			delete: vi.fn(),
			list: vi.fn(),
		};
		const entries = [
			{ key: 'WBGT_20250709_15', value: '30' },
			{ key: 'WBGT_20250709_18', value: '29' },
		];

		await saveWbgtDataToKV(entries, { WBGT_KV: mockKV as any });

		expect(mockKV.put).toHaveBeenCalledTimes(2); // Should call put for both entries
		expect(mockKV.put).toHaveBeenCalledWith('WBGT_20250709_15', '30', { expirationTtl: 86400 });
		expect(mockKV.put).toHaveBeenCalledWith('WBGT_20250709_18', '29', { expirationTtl: 86400 });
	});

	it('should not save WBGT data to KV if value is the same', async () => {
		const mockKV = {
			put: vi.fn(),
			get: vi.fn((key) => {
				if (key === 'WBGT_20250709_15') return Promise.resolve('30');
				if (key === 'WBGT_20250709_18') return Promise.resolve('29');
				return Promise.resolve(null);
			}),
			delete: vi.fn(),
			list: vi.fn(),
		};
		const entries = [
			{ key: 'WBGT_20250709_15', value: '30' },
			{ key: 'WBGT_20250709_18', value: '29' },
		];

		await saveWbgtDataToKV(entries, { WBGT_KV: mockKV as any });

		expect(mockKV.put).not.toHaveBeenCalled(); // Should not call put
	});
});

describe('wbgt', () => {
	it('should fetch and store WBGT data in KV', async () => {
		// fetchをモック
		vi.spyOn(global, 'fetch').mockResolvedValueOnce(
			new Response(mockCsvResponse, {
				headers: { 'Content-Type': 'text/csv' },
			})
		);

		// KVNamespaceをモック
		const mockKV = {
			put: vi.fn(),
			get: vi.fn(),
			delete: vi.fn(),
			list: vi.fn(),
		};

		// wbgt関数を呼び出す
		await saveWbgt('62091', { WBGT_KV: mockKV as any });

		// KV.putが正しい引数で呼び出されたことを確認
		expect(mockKV.put).toHaveBeenCalledWith('WBGT_20250709_15', '30', { expirationTtl: 86400 });
		expect(mockKV.put).toHaveBeenCalledWith('WBGT_20250709_18', '29', { expirationTtl: 86400 });
		expect(mockKV.put).toHaveBeenCalledWith('WBGT_20250710_15', '29', { expirationTtl: 86400 });
		expect(mockKV.put).toHaveBeenCalledWith('WBGT_20250710_18', '28', { expirationTtl: 86400 });

		// fetchが正しいURLで呼び出されたことを確認
		expect(global.fetch).toHaveBeenCalledWith('https://www.wbgt.env.go.jp/prev15WG/dl/yohou_62091.csv');
	});
});

describe('getWbgtDataFromKV', () => {
	it('should retrieve WBGT data from KV', async () => {
		const mockKV = {
			put: vi.fn(),
			get: vi.fn(() => Promise.resolve('25')),
			delete: vi.fn(),
			list: vi.fn(),
		};
		const date = new Date(2025, 6, 9); // July 9, 2025
		const hour = 15;

		const data = await getWbgtDataFromKV(date, hour, { WBGT_KV: mockKV as any });

		expect(data).toBe('25');
		expect(mockKV.get).toHaveBeenCalledWith('WBGT_20250709_15');
	});

	it('should return null if data is not found in KV', async () => {
		const mockKV = {
			put: vi.fn(),
			get: vi.fn(() => Promise.resolve(null)),
			delete: vi.fn(),
			list: vi.fn(),
		};
		const date = new Date(2025, 6, 9);
		const hour = 15;

		const data = await getWbgtDataFromKV(date, hour, { WBGT_KV: mockKV as any });

		expect(data).toBeNull();
		expect(mockKV.get).toHaveBeenCalledWith('WBGT_20250709_15');
	});

	it('should retrieve WBGT data for tomorrow from KV', async () => {
		const mockKV = {
			put: vi.fn(),
			get: vi.fn(() => Promise.resolve('28')),
			delete: vi.fn(),
			list: vi.fn(),
		};
		const date = new Date(2025, 6, 10); // July 10, 2025
		const hour = 18;

		const data = await getWbgtDataFromKV(date, hour, { WBGT_KV: mockKV as any });

		expect(data).toBe('28');
		expect(mockKV.get).toHaveBeenCalledWith('WBGT_20250710_18');
	});
});
