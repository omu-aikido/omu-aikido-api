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

	const isLong = new URL(request.url).searchParams.get('long') === 'true';

	const newsletters = await fetchSheet(id, gid).then(sheetToJSON);
	const filteredNewsletters = newsletters.filter((entry: any) => {
		// ターゲットの確認
		const targetMatch = entry.target === 'omu-aikido.com';
		// 開始日の確認（今日以前に公開されたもの）
		const isPublished = entry.startDate <= today;

		if (isLong) {
			// longモード: 公開済みの全てのコンテンツ
			return targetMatch && isPublished;
		} else {
			// 通常モード: 公開済みで、まだ公開期間が終了していないもの
			const isActive = entry.endDate >= today;
			return targetMatch && isPublished && isActive;
		}
	});

	return new Response(JSON.stringify(filteredNewsletters), {
		headers: {
			'Cache-Control': 'max-age=0, s-maxage=7200, stale-while-revalidate=3600',
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

	const isLong = new URL(request.url).searchParams.get('long') === 'true';

	const newsletters = await fetchSheet(id, gid).then(sheetToJSON);
	const filteredNewsletters = newsletters.filter((entry: any) => {
		// ターゲットの確認
		const targetMatch = entry.target === 'app.omu-aikido.com';
		// 開始日の確認（今日以前に公開されたもの）
		const isPublished = entry.startDate <= today;

		if (isLong) {
			// longモード: 公開済みの全てのコンテンツ
			return targetMatch && isPublished;
		} else {
			// 通常モード: 公開済みで、まだ公開期間が終了していないもの
			const isActive = entry.endDate >= today;
			return targetMatch && isPublished && isActive;
		}
	});

	return new Response(JSON.stringify(filteredNewsletters), {
		headers: {
			'Cache-Control': 'max-age=0, s-maxage=7200, stale-while-revalidate=3600',
			'content-type': 'application/json',
			'Access-Control-Allow-Origin': 'https://app.omu-aikido.com',
		},
	});
}
