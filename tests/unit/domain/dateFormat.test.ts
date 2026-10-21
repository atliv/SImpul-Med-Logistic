import { describe, it, expect } from 'vitest';
import { toDatabaseDateTime, formatHumanDateTime } from '../../../src/lib/domain/utils/dateFormat.js';

describe('dateFormat utilities', () => {
	it('converts separate date and time strings into YYYY-MM-DD HH:mm:ss format', () => {
		const result = toDatabaseDateTime('2026-10-25', '14:30');
		expect(result).toBe('2026-10-25 14:30:00');
	});

	it('handles time with seconds already included', () => {
		const result = toDatabaseDateTime('2026-10-25', '09:15:45');
		expect(result).toBe('2026-10-25 09:15:45');
	});

	it('formats database datetime string into compact human-readable display', () => {
		const formatted = formatHumanDateTime('2026-10-25 14:30:00', 'compact');
		expect(formatted).toBe('Oct 25, 2026 · 14:30');
	});

	it('formats database datetime string into full human-readable display', () => {
		const formatted = formatHumanDateTime('2026-10-25 14:30:00', 'full');
		expect(formatted).toContain('Oct 25, 2026 at 14:30');
	});

	it('returns fallback dash for empty/null dates', () => {
		expect(formatHumanDateTime(null)).toBe('—');
		expect(formatHumanDateTime(undefined)).toBe('—');
		expect(formatHumanDateTime('')).toBe('—');
	});
});
