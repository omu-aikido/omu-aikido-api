import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

vi.mock('../src/practice', () => ({
	getUpcomingPractices: vi.fn(),
	hasNakamozu: vi.fn(),
	getNakamozu: vi.fn(),
}));

import { sendDiscord, sendPracticeNotification } from '../src/discord';
import { getUpcomingPractices, hasNakamozu, getNakamozu } from '../src/practice';

describe('sendDiscord', () => {
	const mockEnv = {
		DISCORD_WEBHOOK_URL: 'http://mock-webhook.com',
		WBGT_KV_NAMESPACE: {
			get: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
		},
	};
	let fetchSpy: Mock;

	beforeEach(() => {
		fetchSpy = vi.spyOn(global, 'fetch') as Mock;
		mockEnv.WBGT_KV_NAMESPACE.get.mockReset();
		fetchSpy.mockReset();
	});

	it('WBGT値が基準値を超えない場合、Discord通知を送信しないべきである', async () => {
		mockEnv.WBGT_KV_NAMESPACE.get.mockResolvedValueOnce('27.0').mockResolvedValueOnce('26.0');
		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(0);
	});

	it('WBGT値が31を超えた場合、Discord通知を送信するべきである', async () => {
		mockEnv.WBGT_KV_NAMESPACE.get.mockResolvedValueOnce('32.0').mockResolvedValueOnce('28.0');
		fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, options] = fetchSpy.mock.calls[0];
		expect(url).toBe(mockEnv.DISCORD_WEBHOOK_URL);
		expect(options.method).toBe('POST');
	});

	it('5月未満・9月超は通知しない', async () => {
		const realDate = global.Date;
		global.Date = class extends Date {
			constructor() {
				super();
				this.setMonth(3); // April (4月)
			}
		} as any;
		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(0);
		global.Date = realDate;
	});

	it('WBGT値がnullの場合は通知しない', async () => {
		mockEnv.WBGT_KV_NAMESPACE.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(0);
	});

	it('Discord通知送信時にfetchがPOSTで呼ばれる', async () => {
		mockEnv.WBGT_KV_NAMESPACE.get.mockResolvedValueOnce('29.0').mockResolvedValueOnce('30.0');
		fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledWith(mockEnv.DISCORD_WEBHOOK_URL, expect.objectContaining({ method: 'POST' }));
	});
});

describe('sendPracticeNotification', () => {
	const mockEnv = {
		DISCORD_WEBHOOK_URL: 'http://mock-webhook.com',
	};
	let fetchSpy: Mock;

	beforeEach(() => {
		fetchSpy = vi.spyOn(global, 'fetch') as Mock;
		fetchSpy.mockReset();
		vi.clearAllMocks();
	});

	it('中百舌鳥稽古がない場合は通知しない', async () => {
		(getUpcomingPractices as Mock).mockResolvedValue([]);
		(hasNakamozu as Mock).mockReturnValue(false);

		const result = await sendPracticeNotification(mockEnv);

		expect(result).toBe(false); // 通知しなかったことを明確に示す
		// Discord WebhookのURLが呼び出されていないことを確認
		expect(fetchSpy).not.toHaveBeenCalledWith(mockEnv.DISCORD_WEBHOOK_URL, expect.anything());
	});

	it('中百舌鳥稽古がある場合は通知する', async () => {
		const event = {
			start: { date: new Date().toISOString() },
			end: { date: new Date(Date.now() + 3600000).toISOString() },
			summary: '中百舌鳥',
			location: '中百舌鳥',
			description: '詳細',
		};
		(getUpcomingPractices as Mock).mockResolvedValue([event]);
		(hasNakamozu as Mock).mockReturnValue(true);
		(getNakamozu as Mock).mockReturnValue([event]);
		fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

		const result = await sendPracticeNotification(mockEnv);

		expect(result).toBe(true); // 通知が成功したことを明確に示す
		// Discord WebhookのURLが呼び出されたことを確認
		expect(fetchSpy).toHaveBeenCalledWith(mockEnv.DISCORD_WEBHOOK_URL, expect.objectContaining({ method: 'POST' }));
	});

	it('稽古通知送信失敗時にエラーを出力', async () => {
		const event = {
			start: { date: new Date().toISOString() },
			end: { date: new Date(Date.now() + 3600000).toISOString() },
			summary: '中百舌鳥',
			location: '中百舌鳥',
			description: '詳細',
		};

		(getUpcomingPractices as Mock).mockResolvedValue([event]);
		(hasNakamozu as Mock).mockReturnValue(true);
		(getNakamozu as Mock).mockReturnValue([event]);
		fetchSpy.mockResolvedValue(new Response(null, { status: 500, statusText: 'Internal Server Error' }));

		const result = await sendPracticeNotification(mockEnv);

		expect(result).toBe(false); // エラーで通知が失敗したことを明確に示す
		expect(fetchSpy).toHaveBeenCalledWith(mockEnv.DISCORD_WEBHOOK_URL, expect.objectContaining({ method: 'POST' }));
	});
});
