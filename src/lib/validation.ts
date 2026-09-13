const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d.\-\s]{7,25}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InputError extends Error {}

export function requiredText(
  value: FormDataEntryValue | unknown,
  field: string,
  maxLength: number,
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new InputError(`${field} is required`);
  if (text.length > maxLength) {
    throw new InputError(`${field} is too long`);
  }
  return text;
}

export function yesNoBoolean(value: FormDataEntryValue | unknown, field: string) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "yes" || text === "true") return true;
  if (text === "no" || text === "false") return false;
  throw new InputError(`${field} must be Yes or No`);
}

export function georgiaCoordinate(
  value: FormDataEntryValue | unknown,
  field: "latitude" | "longitude",
) {
  const number = Number(typeof value === "string" ? value.trim() : value);
  if (!Number.isFinite(number)) {
    throw new InputError(`${field} must be a number`);
  }
  const valid =
    field === "latitude"
      ? number >= 30.2 && number <= 35.2
      : number >= -85.7 && number <= -80.6;
  if (!valid) {
    throw new InputError(`${field} must be within Georgia`);
  }
  return number;
}

export function validEmail(value: FormDataEntryValue | unknown) {
  const email = requiredText(value, "Email address", 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new InputError("Enter a valid email address");
  }
  return email;
}

export function validPhone(value: FormDataEntryValue | unknown) {
  const phone = requiredText(value, "Phone number", 25);
  if (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, "").length < 7) {
    throw new InputError("Enter a valid phone number");
  }
  return phone;
}

export function validUuid(value: unknown, field = "id") {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new InputError(`Invalid ${field}`);
  }
  return value;
}

export function validIdempotencyKey(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 16 ||
    value.length > 100 ||
    !/^[a-zA-Z0-9_-]+$/.test(value)
  ) {
    throw new InputError("Invalid request identifier");
  }
  return value;
}
