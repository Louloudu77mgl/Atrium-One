export type GoogleBusinessLocation = {
  accountName: string;
  locationId: string;
  locationName: string;
  address: string | null;
  status: string | null;
};

type GoogleApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
};

type GoogleAccount = {
  name?: string;
};

type GoogleAccountsResponse = {
  accounts?: GoogleAccount[];
};

type GoogleLocation = {
  name?: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    postalCode?: string;
    administrativeArea?: string;
    regionCode?: string;
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
  };
  openInfo?: {
    status?: string;
  };
};

type GoogleLocationsResponse = {
  locations?: GoogleLocation[];
};

export async function getGoogleBusinessLocations(accessToken: string): Promise<GoogleBusinessLocation[]> {
  const accountsResponse = await fetchGoogleApiWithRetry("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", accessToken);

  if (!accountsResponse.ok) {
    throw await createGoogleBusinessError(accountsResponse, "Impossible de récupérer les comptes Google Business.");
  }

  const accountsData = (await accountsResponse.json()) as GoogleAccountsResponse;
  const accounts = accountsData.accounts?.filter((account) => account.name) ?? [];
  const locations: GoogleBusinessLocation[] = [];

  for (const account of accounts) {
    const accountName = account.name;

    if (!accountName) {
      continue;
    }

    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
    url.searchParams.set("readMask", "name,title,storefrontAddress,metadata,openInfo");

    const locationsResponse = await fetchGoogleApiWithRetry(url, accessToken);

    if (!locationsResponse.ok) {
      continue;
    }

    const locationsData = (await locationsResponse.json()) as GoogleLocationsResponse;

    for (const location of locationsData.locations ?? []) {
      if (!location.name) {
        continue;
      }

      locations.push({
        accountName,
        locationId: `${accountName}/${location.name}`,
        locationName: location.title ?? location.name,
        address: formatGoogleAddress(location.storefrontAddress),
        status: location.openInfo?.status ?? null
      });
    }
  }

  return locations;
}

async function fetchGoogleApi(url: string | URL, accessToken: string) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });
}

async function fetchGoogleApiWithRetry(url: string | URL, accessToken: string) {
  const delays = [1200, 2500, 5000, 9000];
  let response = await fetchGoogleApi(url, accessToken);

  for (const delay of delays) {
    if (!isQuotaResponse(response)) {
      return response;
    }

    await sleep(getRetryDelay(response, delay));
    response = await fetchGoogleApi(url, accessToken);
  }

  return response;
}

function isQuotaResponse(response: Response) {
  return response.status === 429;
}

function getRetryDelay(response: Response, fallback: number) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : 0;

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 15000);
  }

  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createGoogleBusinessError(response: Response, fallbackMessage: string) {
  const payload = (await readGoogleErrorPayload(response)) ?? {};
  const apiMessage = payload.error?.message?.trim();
  const apiReason = payload.error?.details?.find((detail) => detail.reason)?.reason;
  const normalizedMessage = apiMessage?.toLowerCase() ?? "";

  if (response.status === 401) {
    return new Error("La connexion Google a expiré. Reconnectez votre compte Google puis réessayez.");
  }

  if (response.status === 403) {
    if (normalizedMessage.includes("api has not been used") || normalizedMessage.includes("is not enabled")) {
      return new Error("L’API Google Business n’est pas activée dans Google Cloud pour ce projet.");
    }

    if (normalizedMessage.includes("verification")) {
      return new Error("Google demande une vérification supplémentaire avant d’accéder à vos fiches Business.");
    }

    return new Error("Google a refusé l’accès aux fiches Business. Vérifiez que le compte a bien accès à la fiche et que l’API est activée.");
  }

  if (response.status === 404) {
    return new Error("Aucune fiche Google Business n’a été trouvée pour ce compte.");
  }

  if (response.status === 429 || normalizedMessage.includes("quota exceeded") || normalizedMessage.includes("requests per minute")) {
    return new Error("Google limite temporairement les requêtes Business Profile. Attendez 1 à 2 minutes puis relancez la synchronisation.");
  }

  if (apiReason === "SERVICE_DISABLED") {
    return new Error("L’API Google Business n’est pas activée dans Google Cloud pour ce projet.");
  }

  return new Error(apiMessage || fallbackMessage);
}

async function readGoogleErrorPayload(response: Response) {
  try {
    return (await response.json()) as GoogleApiErrorPayload;
  } catch {
    return null;
  }
}

function formatGoogleAddress(address?: GoogleLocation["storefrontAddress"]) {
  if (!address) {
    return null;
  }

  return [
    ...(address.addressLines ?? []),
    [address.postalCode, address.locality].filter(Boolean).join(" "),
    address.administrativeArea,
    address.regionCode
  ]
    .filter(Boolean)
    .join(", ");
}
