import { getUpcomingPractices, hasNakamozu, getNakamozu } from './practice';
import { getWbgtDataFromKV } from './wbgt';
import type { VEvent } from 'ts-ics';

// 既存のsendDiscord関数（WBGT通知）
export async function sendDiscord(env: { DISCORD_WEBHOOK_URL: string; WBGT_KV_NAMESPACE: KVNamespace }) {
	// 5月から9月のみ実行
	const now = new Date();
	const month = now.getMonth() + 1;
	if (month < 5 || month > 9) {
		console.log('WBGT通知は5月から9月のみ実行されます');
		return;
	}

	// 15時と18時のWBGT値を取得
	const [wbgt15, wbgt18] = await Promise.all([env.WBGT_KV_NAMESPACE.get('WBGT_TODAY_15'), env.WBGT_KV_NAMESPACE.get('WBGT_TODAY_18')]);

	const value15 = wbgt15 ? parseFloat(wbgt15) : null;
	const value18 = wbgt18 ? parseFloat(wbgt18) : null;

	const shouldAlert = () => {
		if (!value18) return false;
		if (value18 >= 28) return true;
		return false;
	};

	const isHigh = shouldAlert();
	const maxValue = Math.max(value15 || 0, value18 || 0);

	console.log(`WBGT値: 15時=${value15}, 18時=${value18}, 最大値=${maxValue}`);

	const getWbgtLevel = (value: number) => {
		if (value >= 31) return { level: '危険', color: 15158332 };
		if (value >= 28) return { level: '厳重警戒', color: 16753920 };
		if (value >= 25) return { level: '警戒', color: 16776960 };
		if (value >= 21) return { level: '注意', color: 65280 };
		return { level: '安全', color: 255 };
	};

	const { level, color } = getWbgtLevel(value18 || maxValue);
	console.log(`WBGTレベル: ${level}, 色コード: ${color}`);

	const requestBody = {
		content: '**WBGT予報**',
		username: 'WBGT Bot',
		embeds: [
			{
				title: `今日のWBGT予測`,
				description: `15時: ${value15 ? value15 + '°C' : 'N/A'}\n18時: ${value18 ? value18 + '°C' : 'N/A'}\n\n**${level}**`,
				color,
				timestamp: new Date().toISOString(),
			},
		],
	};

	console.log(requestBody);

	if (!isHigh) {
		console.log('WBGT値は高くありません。通知を送信しません。');
		return;
	}

	try {
		const response = await fetch(env.DISCORD_WEBHOOK_URL, {
			method: 'POST',
			body: JSON.stringify(requestBody),
			headers: { 'Content-Type': 'application/json' },
		});
		console.log(`Discord通知送信: ${response.status}`);
	} catch (error) {
		console.error('Discord通知エラー:', error);
	}
}

// WBGT参考値を取得するヘルパー関数
async function getCurrentWbgtForReference(env: { WBGT_KV_NAMESPACE: KVNamespace }): Promise<string> {
	try {
		// UTC時刻をJSTに変換（UTC+9）
		const nowUTC = new Date();
		const nowJST = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);
		
		const todayJST = new Date(nowJST.getFullYear(), nowJST.getMonth(), nowJST.getDate());
		
		// 15時と18時のWBGT値を取得
		const [wbgt15, wbgt18] = await Promise.all([
			getWbgtDataFromKV(todayJST, 15, { WBGT_KV: env.WBGT_KV_NAMESPACE }),
			getWbgtDataFromKV(todayJST, 18, { WBGT_KV: env.WBGT_KV_NAMESPACE })
		]);
		
		const value15 = wbgt15 ? parseFloat(wbgt15) : null;
		const value18 = wbgt18 ? parseFloat(wbgt18) : null;
		
		if (value15 !== null || value18 !== null) {
			const parts = [];
			if (value15 !== null) parts.push(`15時: ${value15}°C`);
			if (value18 !== null) parts.push(`18時: ${value18}°C`);
			return `\n**WBGT参考値**: ${parts.join(', ')}`;
		}
		
		return '';
	} catch (error) {
		console.error('WBGT取得エラー:', error);
		return '';
	}
}

// 新しい中百舌鳥稽古通知関数
export async function sendPracticeNotification(env: any): Promise<boolean> {
	try {
		const practices = await getUpcomingPractices();
		if (!hasNakamozu(practices)) {
			return false; // 通知しなかった
		}

		const nakamozuPractices = getNakamozu(practices);
		console.log(`中百舌鳥稽古が${nakamozuPractices.length}件見つかりました`);

		// イベントが見つかった場合、WBGT通知も送信
		await sendDiscord(env);

		// WBGT参考値を取得
		const wbgtReference = await getCurrentWbgtForReference(env);

		for (const event of nakamozuPractices) {
			const startTime = new Date(event.start.date);
			const endTime = event.end ? new Date(event.end.date) : null;

			// 時間のフォーマット
			const formatTime = (date: Date) => {
				return date.toLocaleString('ja-JP', {
					month: 'numeric',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'Asia/Tokyo',
				});
			};

			const timeText = endTime ? `${formatTime(startTime)} - ${formatTime(endTime)}` : formatTime(startTime);

			const requestBody = {
				content: '**稽古のお知らせ**',
				username: '稽古通知Bot',
				embeds: [
					{
						title: event.summary || '稽古',
						description: `**開始時間**: ${timeText}\n**場所**: ${event.location || '中百舌鳥'}${
							event.description ? `\n**詳細**: ${event.description}` : ''
						}${wbgtReference}`,
						color: 3447003, // 青色
						timestamp: new Date().toISOString(),
					},
				],
			};

			console.log('送信する内容:', requestBody);

			const response = await fetch(env.DISCORD_WEBHOOK_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
			});

			if (response.ok) {
				console.log(`稽古通知送信成功: ${response.status}`);
			} else {
				console.error(`稽古通知送信失敗: ${response.status} - ${response.statusText}`);
				return false; // HTTP エラーの場合は false を返す
			}
		}
		return true; // 通知が成功した
	} catch (error) {
		console.error('稽古通知エラー:', error);
		return false;
	}
}
