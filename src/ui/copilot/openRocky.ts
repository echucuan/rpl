/** Opens Rocky's chat panel from anywhere in the app, optionally with a question ready to send. */
export const OPEN_ROCKY = "rpl:open-rocky";

export function openRocky(question?: string) {
  dispatchEvent(new CustomEvent<string | undefined>(OPEN_ROCKY, { detail: question }));
}
