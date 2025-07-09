import { Hono } from 'hono';
import { getOmuaikidoNews, getAppNews } from './news';
import { getCalendarEvents } from './calendar';

const app = new Hono();

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
	return;
});

app.notFound((c) => {
	return c.text('Not Found', 404);
});

export default app;
