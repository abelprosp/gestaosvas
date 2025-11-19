import type { Vendor } from "../api/users";

function capitalizeWords(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

export function vendorDisplayName(vendor: Vendor): string {
  if (vendor.name && vendor.name.trim().length > 0) {
    return vendor.name.trim();
  }

  if (vendor.email) {
    const localPart = vendor.email.split("@")[0];
    if (localPart) {
      const normalized = localPart.replace(/[._-]+/g, " ");
      return capitalizeWords(normalized);
    }
  }

  return "";
}









