import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for conditionally joining Tailwind CSS class names
 * with intelligent merging of conflicting utilities.
 *
 * @example cn('px-4 py-2', 'px-6') → 'py-2 px-6'
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
