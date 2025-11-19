export function generateContractContent(
  template: string,
  data: Record<string, string | number | null | undefined>,
) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = data[key];
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  });
}










