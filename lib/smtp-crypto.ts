import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const raw = process.env.SMTP_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error("SMTP_ENCRYPTION_KEY manquante.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "SMTP_ENCRYPTION_KEY invalide : la clé doit faire 32 octets."
    );
  }

  return key;
}

export function encryptSmtpPassword(password: string) {
  if (!password) {
    throw new Error("Mot de passe SMTP manquant.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptSmtpPassword(payload: string) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] =
    payload.split(".");

  if (
    version !== "v1" ||
    !ivEncoded ||
    !tagEncoded ||
    !encryptedEncoded
  ) {
    throw new Error("Mot de passe SMTP chiffré invalide.");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivEncoded, "base64url")
    );

    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, "base64url")),
      decipher.final()
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new Error("Impossible de déchiffrer le mot de passe SMTP.");
  }
}
