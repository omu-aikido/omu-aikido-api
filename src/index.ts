// itty-routerは使用せず、手動でルーティングするためimportを削除
// import { Router } from 'itty-router';
import { getOmuaikidoNews, getAppNews } from './news';
import { getCalendarEvents } from './calendar';

export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		const { pathname } = new URL(request.url);

		// 手動ルーティング処理
		if (pathname === '/news') {
			return getOmuaikidoNews(request);
		} else if (pathname === '/app/news') {
			return getAppNews(request);
		} else if (pathname === '/calendar') {
			return getCalendarEvents(request);
		} else {
			return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler;
