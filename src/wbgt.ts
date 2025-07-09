export async function wbgt(params: string | undefined) {
	const point = params || '62091';
	const response = await fetch(`https://www.wbgt.env.go.jp/prev15WG/dl/yohou_${point}.csv`);
	console.log(response);
}
