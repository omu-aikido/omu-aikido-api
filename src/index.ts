import { Hono } from 'hono';
import { getOmuaikidoNews, getAppNews } from './news';
import { getCalendarEvents } from './calendar';
import { wbgt } from './wbgt';
import { sendDiscord, sendPracticeNotification } from './discord';

type Bindings = {
	WBGT_KV_NAMESPACE: KVNamespace;
	DISCORD_WEBHOOK_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/news', async (c) => {
	return getOmuaikidoNews(c.req.raw);
});

app.get('/app/news', async (c) => {
	return getAppNews(c.req.raw);
});

app.get('/calendar', async (c) => {
	return getCalendarEvents(c.req.raw);
});

app.get('/wbgt', async (c) => {
	const kvData = await wbgt(c);
	return c.json(kvData);
});

// HonoアプリとScheduledイベントハンドラをエクスポート
export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
		// 稽古通知を送信（2時間おき）
		ctx.waitUntil(sendPracticeNotification(env));

		// WBGT通知は5月-9月の月・火・土の4時のみ（元の動作を維持）
		const now = new Date();
		const hour = now.getHours();
		const day = now.getDay(); // 0=日曜, 1=月曜, 2=火曜, 6=土曜
		const month = now.getMonth() + 1;

		if (hour === 4 && (day === 1 || day === 2 || day === 6) && month >= 5 && month <= 9) {
			ctx.waitUntil(sendDiscord(env));
		}
	},
};
