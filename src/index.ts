import { Hono } from 'hono';
import { getOmuaikidoNews, getAppNews } from './news';
import { getCalendarEvents } from './calendar';
import { wbgt } from './wbgt';
import { sendDiscord } from './discord';

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
		ctx.waitUntil(sendDiscord(env));
	},
};
