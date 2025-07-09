import { sendDiscord } from '../src/discord';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

describe('sendDiscord', () => {
	const mockEnv = { DISCORD_WEBHOOK_URL: 'http://mock-webhook.com' };
	let fetchSpy: Mock; // Mock 型を明示的に指定

	beforeEach(() => {
		fetchSpy = vi.spyOn(global, 'fetch') as Mock; // as Mock で型アサーション
	});

	it('WBGT値が31を超えない場合、Discord通知を送信しないべきである', async () => {
		fetchSpy.mockImplementationOnce((url: any) => {
			// url の型を any に変更
			if (url.toString().includes('/wbgt')) {
				return Promise.resolve(new Response(JSON.stringify({ location1: '30.0', location2: '25.0' }), { status: 200 }));
			}
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(1); // WBGTデータフェッチのみ
	});

	it('WBGT値が31を超えた場合、Discord通知を送信するべきである', async () => {
		fetchSpy.mockImplementationOnce((url: any) => {
			// url の型を any に変更
			if (url.toString().includes('/wbgt')) {
				return Promise.resolve(new Response(JSON.stringify({ location1: '32.0', location2: '28.0' }), { status: 200 }));
			}
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(2); // WBGTデータフェッチとDiscord webhook
		expect(fetchSpy).toHaveBeenCalledWith(
			mockEnv.DISCORD_WEBHOOK_URL,
			expect.objectContaining({
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: expect.stringContaining('WBGT通知: WBGT値が31を超えました！'),
			})
		);
	});

	it('WBGTデータフェッチが失敗した場合、Discord通知を送信しないべきである', async () => {
		fetchSpy.mockImplementationOnce((url: any) => {
			// url の型を any に変更
			if (url.toString().includes('/wbgt')) {
				return Promise.resolve(new Response(null, { status: 500, statusText: 'Internal Server Error' }));
			}
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		// console.errorをモックしてエラー出力を抑制
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(1); // WBGTデータフェッチのみ
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch WBGT data:', 500, 'Internal Server Error');
		consoleErrorSpy.mockRestore(); // モックを元に戻す
	});

	it('WBGTデータにnull値が含まれていても、正しく処理されるべきである', async () => {
		fetchSpy.mockImplementationOnce((url: any) => {
			// url の型を any に変更
			if (url.toString().includes('/wbgt')) {
				return Promise.resolve(new Response(JSON.stringify({ location1: '32.5', location2: null, location3: '29.0' }), { status: 200 }));
			}
			return Promise.resolve(new Response(null, { status: 200 }));
		});

		await sendDiscord(mockEnv);
		expect(fetchSpy).toHaveBeenCalledTimes(2); // WBGTデータフェッチとDiscord webhook
		expect(fetchSpy).toHaveBeenCalledWith(
			mockEnv.DISCORD_WEBHOOK_URL,
			expect.objectContaining({
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: expect.stringContaining('location1: 32.5'),
			})
		);
	});
});
