const DISALLOWED_CHARACTERS = /[<>`]/g;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

export const sanitizePlainText = (value: string) =>
  value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(DISALLOWED_CHARACTERS, "")
    .trim();
