// Boulangerie Oulah: changing a business name must not enable demo controls.
const DEMO_MERCHANT_ID = "dfe516ad-4c27-497b-afb2-4e836cdd3fcf";

export function isDemoMerchant(merchant?: { id: string } | null) {
  return merchant?.id === DEMO_MERCHANT_ID;
}
