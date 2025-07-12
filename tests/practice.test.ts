import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getUpcomingPractices, hasNakamozu, getNakamozu } from '../src/practice';
import { sendPracticeNotification } from '../src/discord';

// モックのカレンダーデータ
const mockCalendarData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test1@example.com
DTSTART:20250712T100000Z
DTEND:20250712T110000Z
SUMMARY:中百舌鳥稽古
LOCATION:中百舌鳥キャンパス
DESCRIPTION:通常の稽古です
END:VEVENT
BEGIN:VEVENT
UID:test2@example.com
DTSTART:20250712T130000Z
DTEND:20250712T140000Z
SUMMARY:他の稽古
LOCATION:他の場所
DESCRIPTION:中百舌鳥以外の稽古
END:VEVENT
END:VCALENDAR`;

const mockCalendarDataNoNakamozu = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test3@example.com
DTSTART:20250712T100000Z
DTEND:20250712T110000Z
SUMMARY:通常稽古
LOCATION:他の場所
DESCRIPTION:通常の稽古です
END:VEVENT
END:VCALENDAR`;

describe('Practice Notification', () => {
	let fetchSpy: Mock;

	beforeEach(() => {
		fetchSpy = vi.spyOn(global, 'fetch') as Mock;
		// 現在時刻を2025年7月12日 9時に固定（10時の稽古の1時間前）
		vi.setSystemTime(new Date('2025-07-12T09:00:00.000Z'));
	});

	describe('getUpcomingPractices', () => {
		it('2時間以内の稽古を取得できること', async () => {
			fetchSpy.mockResolvedValueOnce(
				new Response(mockCalendarData, {
					headers: { 'Content-Type': 'text/calendar' },
				})
			);

			const events = await getUpcomingPractices();
			expect(events).toHaveLength(1);
			expect(events[0].summary).toBe('中百舌鳥稽古');
		});

		it('カレンダー取得に失敗した場合、空配列を返すこと', async () => {
			fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500, statusText: 'Internal Server Error' }));

			const events = await getUpcomingPractices();
			expect(events).toEqual([]);
		});
	});

	describe('hasNakamozu', () => {
		it('中百舌鳥を含む稽古がある場合trueを返すこと', () => {
			const events = [
				{
					summary: '中百舌鳥稽古',
					start: { date: '2025-07-12T10:00:00.000Z' },
					location: '中百舌鳥キャンパス',
				},
			] as any;

			expect(hasNakamozu(events)).toBe(true);
		});

		it('中百舌鳥を含む稽古がない場合falseを返すこと', () => {
			const events = [
				{
					summary: '通常稽古',
					start: { date: '2025-07-12T10:00:00.000Z' },
					location: '他の場所',
				},
			] as any;

			expect(hasNakamozu(events)).toBe(false);
		});
	});

	describe('getNakamozu', () => {
		it('中百舌鳥を含む稽古のみを返すこと', () => {
			const events = [
				{
					summary: '中百舌鳥稽古',
					start: { date: '2025-07-12T10:00:00.000Z' },
					location: '中百舌鳥キャンパス',
				},
				{
					summary: '通常稽古',
					start: { date: '2025-07-12T10:00:00.000Z' },
					location: '他の場所',
				},
			] as any;

			const nakamozu = getNakamozu(events);
			expect(nakamozu).toHaveLength(1);
			expect(nakamozu[0].summary).toBe('中百舌鳥稽古');
		});
	});

	describe('sendPracticeNotification', () => {
		const mockEnv = { DISCORD_WEBHOOK_URL: 'http://mock-webhook.com' };

		it('中百舌鳥稽古がある場合、Discord通知を送信すること', async () => {
			fetchSpy
				.mockResolvedValueOnce(
					new Response(mockCalendarData, {
						headers: { 'Content-Type': 'text/calendar' },
					})
				)
				.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

			await sendPracticeNotification(mockEnv);

			expect(fetchSpy).toHaveBeenCalledTimes(2);
			expect(fetchSpy).toHaveBeenCalledWith(
				mockEnv.DISCORD_WEBHOOK_URL,
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: expect.stringContaining('稽古のお知らせ'),
				})
			);
		});

		it('中百舌鳥稽古がない場合、Discord通知を送信しないこと', async () => {
			fetchSpy.mockResolvedValueOnce(
				new Response(mockCalendarDataNoNakamozu, {
					headers: { 'Content-Type': 'text/calendar' },
				})
			);

			await sendPracticeNotification(mockEnv);

			expect(fetchSpy).toHaveBeenCalledTimes(1); // カレンダー取得のみ
		});
	});
});
