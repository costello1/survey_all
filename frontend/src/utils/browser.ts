export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
