/**
 * Date and time formatting utilities for logistics and historical delivery records.
 * Supports human-readable formats for UI presentation and standard SQL/ISO formats
 * for database persistence (YYYY-MM-DD HH:mm:ss).
 */

/**
 * Converts a date input (YYYY-MM-DD) and time input (HH:mm or HH:mm:ss)
 * into standard database format: "YYYY-MM-DD HH:mm:ss".
 */
export function toDatabaseDateTime(dateStr: string, timeStr?: string): string {
	const trimmedDate = dateStr.trim();
	if (!trimmedDate) {
		const now = new Date();
		return now.toISOString().replace('T', ' ').slice(0, 19);
	}

	// If already a full datetime string with space or T
	if (trimmedDate.includes(' ') || trimmedDate.includes('T')) {
		const normalized = trimmedDate.replace('T', ' ');
		return normalized.length === 16 ? `${normalized}:00` : normalized.slice(0, 19);
	}

	let time = timeStr?.trim();
	if (!time) {
		const now = new Date();
		time = now.toTimeString().slice(0, 8); // e.g. "14:30:00"
	} else if (time.length === 5) {
		// "HH:mm" -> "HH:mm:00"
		time = `${time}:00`;
	}

	return `${trimmedDate} ${time}`;
}

/**
 * Formats a date string (e.g. "2026-10-19 14:00:00" or ISO string) into a
 * human-readable format.
 *
 * Styles:
 * - 'compact': "Oct 19, 2026 · 14:00" (ideal for table cells)
 * - 'full': "Monday, Oct 19, 2026 at 14:00" (ideal for headers and modals)
 * - 'dateOnly': "Oct 19, 2026"
 * - 'timeOnly': "14:00"
 */
export function formatHumanDateTime(
	dateStr: string | null | undefined,
	style: 'compact' | 'full' | 'dateOnly' | 'timeOnly' = 'compact'
): string {
	if (!dateStr) return '—';

	// Replace space with T for Date parser compatibility across browsers
	const isoCandidate = dateStr.replace(' ', 'T');
	const d = new Date(isoCandidate);

	if (isNaN(d.getTime())) {
		return dateStr;
	}

	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	const year = d.getFullYear();
	const month = months[d.getMonth()];
	const day = d.getDate();
	const weekday = daysOfWeek[d.getDay()];
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');

	switch (style) {
		case 'compact':
			return `${month} ${day}, ${year} · ${hours}:${minutes}`;
		case 'full':
			return `${weekday}, ${month} ${day}, ${year} at ${hours}:${minutes}`;
		case 'dateOnly':
			return `${month} ${day}, ${year}`;
		case 'timeOnly':
			return `${hours}:${minutes}`;
		default:
			return `${month} ${day}, ${year} · ${hours}:${minutes}`;
	}
}
