"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/lib/design-system";

type Provider = "infomaniak" | "ovh" | "ionos" | "custom";

const PRESETS = {
  infomaniak: {
    label: "Infomaniak",
    host: "mail.infomaniak.com",
    port: 587,
    secure: false
  },
  ovh: {
    label: "OVH",
    host: "ssl0.ovh.net",
    port: 587,
    secure: false
  },
  ionos: {
    label: "IONOS",
    host: "smtp.ionos.fr",
    port: 587,
    secure: false
  },
  custom: {
    label: "Autre",
    host: "",
    port: 587,
    secure: false
  }
} satisfies Record<
  Provider,
  {
    label: string;
    host: string;
    port: number;
    secure: boolean;
  }
>;

export function SmtpConnectionActions({
  connected,
  address,
  provider: initialProvider
}: {
  connected: boolean;
  address?: string | null;
  provider?: string | null;
}) {
  const router = useRouter();

  const [provider, setProvider] = useState<Provider>(
    initialProvider && initialProvider in PRESETS
      ? initialProvider as Provider
      : "infomaniak"
  );

  const initialPreset = PRESETS[provider];

  const [email, setEmail] = useState(address || "");
  const [password, setPassword] = useState("");

  const [host, setHost] = useState(initialPreset.host);
  const [port, setPort] = useState(initialPreset.port);
  const [secure, setSecure] = useState<boolean>(initialPreset.secure);
  const [username, setUsername] = useState(address || "");

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [busy, setBusy] = useState<
    "connect" | "test" | "disconnect" | null
  >(null);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function changeProvider(next: Provider) {
    const preset = PRESETS[next];

    setProvider(next);
    setHost(preset.host);
    setPort(preset.port);
    setSecure(preset.secure);
    setUsername(email);
    setShowAdvanced(next === "custom");
    setNotice("");
    setError("");
  }

  function changeEmail(value: string) {
    const previous = email;

    setEmail(value);

    if (!username || username === previous) {
      setUsername(value);
    }
  }

  async function connect() {
    setBusy("connect");
    setNotice("");
    setError("");

    try {
      const preset = PRESETS[provider];

      const response = await fetch("/api/smtp/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider,
          email_address: email,
          from_name: null,
          smtp_host: provider === "custom" ? host : preset.host,
          smtp_port: provider === "custom" ? port : preset.port,
          smtp_secure:
            provider === "custom" ? secure : preset.secure,
          smtp_username:
            provider === "custom"
              ? username
              : email,
          smtp_password: password
        })
      });

      const payload = await response.json() as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
          "Impossible de connecter cette adresse."
        );
      }

      setPassword("");
      setNotice("Adresse connectée.");
      router.refresh();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossible de connecter cette adresse."
      );
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    setBusy("test");
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/smtp/test", {
        method: "POST"
      });

      const payload = await response.json() as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "La connexion ne fonctionne plus."
        );
      }

      setNotice("La connexion fonctionne.");
      router.refresh();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : "Impossible de vérifier la connexion."
      );
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/smtp/disconnect", {
        method: "POST"
      });

      const payload = await response.json() as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "Déconnexion impossible."
        );
      }

      setPassword("");
      router.refresh();
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : "Déconnexion impossible."
      );
    } finally {
      setBusy(null);
    }
  }

  if (connected) {
    return (
      <div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#DDEBDD] bg-[#F5FBF6] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#211432]">
              ✓ {address || "Adresse connectée"}
            </p>
            <p className="mt-0.5 text-xs text-[#6B617F]">
              Prête à envoyer vos campagnes
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={busy !== null}
            className={`${buttonStyles.secondary} disabled:opacity-50`}
          >
            {busy === "test" ? "Test…" : "Tester"}
          </button>

          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy !== null}
            className={`${buttonStyles.tertiary} text-red-700 disabled:opacity-50`}
          >
            {busy === "disconnect"
              ? "Déconnexion…"
              : "Déconnecter"}
          </button>
        </div>

        {notice ? (
          <p className="mt-2 text-xs font-semibold text-emerald-700">
            ✓ {notice}
          </p>
        ) : null}

        {error ? (
          <p className="mt-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.entries(PRESETS) as [
          Provider,
          (typeof PRESETS)[Provider]
        ][]).map(([value, item]) => (
          <button
            key={value}
            type="button"
            onClick={() => changeProvider(value)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              provider === value
                ? "border-[#7C3AED] bg-[#F3E8FF] text-[#4C1D95]"
                : "border-[#E5DDF0] bg-white text-[#6B617F] hover:border-[#C4B5FD]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#6B617F]">
            Adresse e-mail
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => changeEmail(event.target.value)}
            placeholder="bonjour@moncommerce.fr"
            autoComplete="email"
            className="w-full rounded-xl border border-[#D8CAEE] bg-white px-3.5 py-3 text-sm text-[#211432] outline-none transition focus:border-[#7C3AED]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#6B617F]">
            Mot de passe de la boîte mail
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-[#D8CAEE] bg-white px-3.5 py-3 text-sm text-[#211432] outline-none transition focus:border-[#7C3AED]"
          />
        </div>
      </div>

      {provider === "custom" ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-[#6D28D9] hover:underline"
          >
            {showAdvanced
              ? "Masquer les paramètres avancés"
              : "Paramètres avancés"}
          </button>

          {showAdvanced ? (
            <div className="mt-3 space-y-3 rounded-xl border border-[#E9D5FF] bg-[#FBF9FF] p-3">
              <input
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="Serveur SMTP"
                className="w-full rounded-lg border border-[#D8CAEE] bg-white px-3 py-2.5 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={port}
                  onChange={(event) =>
                    setPort(Number(event.target.value))
                  }
                  placeholder="Port"
                  className="w-full rounded-lg border border-[#D8CAEE] bg-white px-3 py-2.5 text-sm"
                />

                <select
                  value={secure ? "tls" : "starttls"}
                  onChange={(event) =>
                    setSecure(event.target.value === "tls")
                  }
                  className="w-full rounded-lg border border-[#D8CAEE] bg-white px-3 py-2.5 text-sm"
                >
                  <option value="starttls">STARTTLS</option>
                  <option value="tls">SSL / TLS</option>
                </select>
              </div>

              <input
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Identifiant SMTP"
                className="w-full rounded-lg border border-[#D8CAEE] bg-white px-3 py-2.5 text-sm"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void connect()}
        disabled={
          busy !== null ||
          !email ||
          !password ||
          (provider === "custom" &&
            (!host || !username || !port))
        }
        className={`${buttonStyles.primary} mt-4 w-full disabled:opacity-50`}
      >
        {busy === "connect"
          ? "Connexion en cours…"
          : "Connecter"}
      </button>

      <p className="mt-2 text-center text-[11px] leading-4 text-[#9A90AA]">
        Votre mot de passe est chiffré et sert uniquement à l’envoi.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
