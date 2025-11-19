const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%^&*()-_=+";

const ALL = `${UPPERCASE}${LOWERCASE}${DIGITS}${SPECIAL}`;

function getRandomChar(charset: string) {
  return charset[Math.floor(Math.random() * charset.length)];
}

export function generateSecurePassword(length = 10): string {
  if (length < 6) {
    throw new Error("Password length must be at least 6 characters.");
  }

  const chars = [
    getRandomChar(UPPERCASE),
    getRandomChar(LOWERCASE),
    getRandomChar(DIGITS),
    getRandomChar(SPECIAL),
  ];

  for (let i = chars.length; i < length; i += 1) {
    chars.push(getRandomChar(ALL));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function generateNumericPassword(length = 4): string {
  if (length < 1) {
    throw new Error("Password length must be at least 1.");
  }

  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += getRandomChar(DIGITS);
  }
  return result;
}

