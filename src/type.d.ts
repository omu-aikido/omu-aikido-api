import { z } from 'zod';

export const JSONDataSchema = z.object({
	timestamp: z.date(),
	email: z.string().email(),
	startDate: z.date(),
	endDate: z.date(),
	target: z.enum(['omu-aikido.com', 'app.omu-aikido.com']),
	importance: z.enum(['Caution', 'High', 'Mideum', 'Low']),
	title: z.string(),
	summary: z.string().optional(),
	body: z.string(),
});

export interface ErrorData {
	reason: string;
	message: string;
	detailed_message: string;
}

export interface TableData {
	cols: Column[];
	rows: Row[];
}

export interface Row {
	c: (Cell | null)[];
}

export interface Column {
	id: string;
	label: string;
	type: string;
	pattern?: string;
}

export interface Cell {
	f?: string;
	v: string | number | null;
}
