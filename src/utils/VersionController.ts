import { registerComponentVersion, getComponentVersion, getAllComponentVersions } from './versionRegistry.ts';

interface VersionManagerConfig {
  cacheTTL?: number; // Cache time-to-live in milliseconds (default: 5 minutes)
}

class VersionManager {
  private static instance: VersionManager;
  private cache: Record<string, string> = {};
  private cacheExpiry: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  private loadingPromise: Promise<void> | null = null;

  private constructor(config: VersionManagerConfig = {}) {
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000;
  }

  static getInstance(config?: VersionManagerConfig): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager(config);
    }
    return VersionManager.instance;
  }

  /**
   * Load component versions from backend
   * @param forceRefresh - Force refresh even if cache is valid
   */
  async loadVersions(forceRefresh: boolean = false): Promise<void> {
    // Prevent concurrent loads
    if (this.loadingPromise && !forceRefresh) {
      return this.loadingPromise;
    }

    // Check cache expiry
    if (!forceRefresh && Date.now() < this.cacheExpiry) {
      return Promise.resolve();
    }

    this.loadingPromise = this.fetchAndRegister();
    await this.loadingPromise;
    this.loadingPromise = null;
  }

  /**
   * Fetch versions from backend and register them
   */
  private async fetchAndRegister(): Promise<void> {
    try {
      const versions = await getAllComponentVersions();
      Object.entries(versions).forEach(([name, version]) => {
        this.cache[name] = version;
      });
      this.cacheExpiry = Date.now() + this.cacheTTL;
    } catch (err) {
      console.warn(' Failed to load component versions:', err);
    }
  }

  /**
   * Get version for a specific component
   * @param name - Component name
   * @param defaultValue - Default version if not found
   */
  getVersion(name: string, defaultValue: string = "0.0.0"): string {
    return getComponentVersion(name) || this.cache[name] || defaultValue;
  }

  /**
   * Get all component versions
   */
  getAllVersions(): Record<string, string> {
    return getAllComponentVersions();
  }

  /**
   * Register a component version (for self-registration)
   * @param name - Component name
   * @param version - Version string
   */
  registerComponent(name: string, version: string): void {
    registerComponentVersion(name, version);
    this.cache[name] = version;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    return Date.now() < this.cacheExpiry;
  }

  /**
   * Clear cache and force refresh
   */
  async refresh(): Promise<void> {
    this.cacheExpiry = 0;
    await this.loadVersions(true);
  }
}

export default VersionManager;

