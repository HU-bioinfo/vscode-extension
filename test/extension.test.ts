import * as assert from 'assert';
import '../src/extension';

describe('Extension Test Suite', () => {
	it('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
}); 