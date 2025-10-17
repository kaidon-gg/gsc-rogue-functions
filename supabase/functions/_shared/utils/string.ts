/**
 * Helper function to render optional text with prefix/suffix
 * @param value - The optional value to render
 * @param prefix - Text to add before the value (default: empty)
 * @param suffix - Text to add after the value (default: empty)
 * @returns Formatted string or empty string if value is falsy
 */
export function renderOptional(value?: string, prefix: string = "", suffix: string = ""): string {
  return value ? `${prefix}${value}${suffix}` : "";
}