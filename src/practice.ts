import { icsCalendarToObject, type VEvent } from 'ts-ics';

// カレンダーから稽古情報を取得するヘルパー関数
export async function getUpcomingPractices(): Promise<VEvent[]> {
	const baseURL = 'https://calendar.google.com/calendar/ical/';
	const calendar = 'new.ocuaikido%40gmail.com/public/basic.ics';
	const targetUrl = `${baseURL}${calendar}`;

	try {
		const response = await fetch(targetUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch calendar: ${response.statusText}`);
		}

		const res = await response.text();
		const parsedData = icsCalendarToObject(res);
		const events: VEvent[] | undefined = parsedData.events;

		if (!events) {
			return [];
		}

		const now = new Date();
		const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

		// 今から2時間以内に開始される稽古を取得
		const upcomingEvents = events.filter((event) => {
			const eventStart = new Date(event.start.date);
			return eventStart >= now && eventStart <= twoHoursLater;
		});

		return upcomingEvents;
	} catch (error) {
		console.error('Error fetching calendar:', error);
		return [];
	}
}

// 中百舌鳥を含む稽古があるかチェック
export function hasNakamozu(events: VEvent[]): boolean {
	return events.some((event) => {
		const title = event.summary || '';
		const description = event.description || '';
		const location = event.location || '';

		return title.includes('中百舌鳥') || description.includes('中百舌鳥') || location.includes('中百舌鳥');
	});
}

// 中百舌鳥稽古の詳細を取得
export function getNakamozu(events: VEvent[]): VEvent[] {
	return events.filter((event) => {
		const title = event.summary || '';
		const description = event.description || '';
		const location = event.location || '';

		return title.includes('中百舌鳥') || description.includes('中百舌鳥') || location.includes('中百舌鳥');
	});
}
