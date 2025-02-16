import { fetchSheet, sheetToJSON } from '@/src/lib/functions';

// URL Parameter
// - `start`: string || null : 掲載開始日
// - `end`: string || null : 掲載終了日
// - `long`: boolean || null : False OR Nullでは内容を省略
export async function getOmuaikidoNews(request: Request) {
	// 名前変更: getNews => getOmuaikidoNews
	const id = '1srvGrA-KbgQfid-GbhAJKeS2fc3_eAdm_lRB8POe5z4';
	const gid = '233082604';

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const newsletters = await fetchSheet(id, gid).then(sheetToJSON);
	const filteredNewsletters = newsletters.filter((entry: any) => {
		// ターゲットが omu-aikido.com かつ掲載期間内(startが今日以前かつendが今日以降)を確認
		return entry.target === 'omu-aikido.com' && entry.startDate <= today && entry.endDate >= today;
	});

	return new Response(JSON.stringify(filteredNewsletters), {
		headers: {
			'Cache-Control': 'max-age=0, s-maxage=14400, stale-while-revalidate=3600',
			'content-type': 'application/json',
			'Access-Control-Allow-Origin': 'https://omu-aikido.com',
		},
	});
}

export async function getAppNews(request: Request) {
	// 名前変更: getNews => getOmuaikidoNews
	const id = '1srvGrA-KbgQfid-GbhAJKeS2fc3_eAdm_lRB8POe5z4';
	const gid = '233082604';

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const newsletters = await fetchSheet(id, gid).then(sheetToJSON);
	const filteredNewsletters = newsletters.filter((entry: any) => {
		// ターゲットが omu-aikido.com かつ掲載期間内(startが今日以前かつendが今日以降)を確認
		return entry.target === 'app.omu-aikido.com' && entry.startDate <= today && entry.endDate >= today;
	});

	return new Response(JSON.stringify(filteredNewsletters), {
		headers: {
			'Cache-Control': 'max-age=0, s-maxage=14400, stale-while-revalidate=3600',
			'content-type': 'application/json',
			'Access-Control-Allow-Origin': 'https://app.omu-aikido.com',
		},
	});
}
