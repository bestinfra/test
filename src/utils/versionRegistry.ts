// Internal store (not exposed to UI)

export const componentVersions: Record<string, string> = {};

export function registerComponentVersion(name: string, version: string = "1.0.0") {
  componentVersions[name] = version || "1.0.0";
}

export function getComponentVersion(name: string) {
  return componentVersions[name] || "1.0.0";
}

export function getAllComponentVersions() {
  return componentVersions;
}