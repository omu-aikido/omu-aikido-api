import { describe, it, expect } from 'vitest';
import { wbgt } from '../src/wbgt';

describe('wbgt', () => {
	it('should call wbgt function', async () => {
		await expect(wbgt('62091')).resolves.not.toThrow();
	});
});
