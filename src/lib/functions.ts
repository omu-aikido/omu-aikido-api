import { JSONDataSchema } from '../type';
import { z } from 'zod';

export async function fetchSheet(id: string, gid: string): Promise<string> {
	const txt = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&tq&gid=${gid}`);
	return txt.text();
}
export async function sheetToJSON(txt: string): Promise<z.infer<typeof JSONDataSchema>[]> {
	// Remove any leading non-JSON characters and the google.visualization Query prefix
	const prefix = 'google.visualization.Query.setResponse(';
	const prefixIndex = txt.indexOf(prefix);
	if (prefixIndex !== -1) {
		txt = txt.slice(prefixIndex + prefix.length);
		// Remove trailing characters like ');'
		if (txt.endsWith(');')) {
			txt = txt.slice(0, -2);
		}
		txt = txt.trim();
	}
	const parsed = JSON.parse(txt);
	const rows = parsed.table?.rows || [];
	return rows.map(
		(row: any): z.infer<typeof JSONDataSchema> => ({
			timestamp: new Date(row.c[0]?.f),
			email: row.c[1]?.v,
			startDate: new Date(row.c[2]?.f),
			endDate: new Date(row.c[3]?.f),
			target: row.c[4]?.v,
			importance: row.c[5]?.v,
			title: row.c[6]?.v,
			summary: row.c[7]?.v,
			body: row.c[8]?.v,
		})
	);
}
