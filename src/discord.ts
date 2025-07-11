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
