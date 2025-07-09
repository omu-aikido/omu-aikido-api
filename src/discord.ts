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
	const isHigh = (value15 && value15 >= 31) || (value18 && value18 >= 31);
	const maxValue = Math.max(value15 || 0, value18 || 0);

	const getWbgtLevel = (value: number) => {
		if (value >= 31) return { level: '危険', color: 15158332 };
		if (value >= 28) return { level: '厳重警戒', color: 16753920 };
		if (value >= 25) return { level: '警戒', color: 16776960 };
		if (value >= 21) return { level: '注意', color: 65280 };
		return { level: '安全', color: 255 };
	};

	const { level, color } = getWbgtLevel(maxValue);

	const requestBody = {
		content: isHigh ? '⚠️ **WBGT警告** ⚠️' : '✅ 部活動安全確認',
		username: 'WBGT Bot',
		embeds: [
			{
				title: '今日の部活動 - WBGT予測',
				description: `15時: ${value15 ? value15 + '°C' : 'N/A'}\n18時: ${
					value18 ? value18 + '°C' : 'N/A'
				}\n\n**最高値: ${maxValue}°C (${level})**\n\n${
					isHigh ? '⚠️ 熱中症の危険が高いため、活動の中止または十分な対策を検討してください。' : '✅ 現在の予測では安全な範囲内です。'
				}`,
				color,
				timestamp: new Date().toISOString(),
			},
		],
	};

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
