function getByPath(obj, dotPath) {
  if (!dotPath) return obj;
  return String(dotPath)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
}

class APIDatasetRuntime {
  constructor(config = {}) {
    this.config = Object.assign({
      url: '',
      method: 'GET',
      headers: {},
      data_path: 'data',
      timeout_seconds: 10,
      mockData: [],
    }, config);
  }

  async _fetchSample() {
    if (!this.config.url) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(this.config.timeout_seconds || 10)) * 1000);

    try {
      const res = await fetch(this.config.url, {
        method: String(this.config.method || 'GET').toUpperCase(),
        headers: this.config.headers || {},
        signal: controller.signal,
      });

      if (!res.ok) {
        return [{
          _preview: true,
          _warning: `API preview request failed with status ${res.status}`,
          url: this.config.url,
          status: res.status,
        }];
      }

      let payload;
      try {
        payload = await res.json();
      } catch {
        return [{
          _preview: true,
          _warning: 'API response is not valid JSON for preview mode.',
          url: this.config.url,
        }];
      }

      const extracted = getByPath(payload, this.config.data_path);
      if (Array.isArray(extracted)) return extracted;
      if (Array.isArray(payload)) return payload;
      return [extracted ?? payload];
    } catch (err) {
      return [{
        _preview: true,
        _warning: `API preview request failed: ${err?.message || String(err)}`,
        url: this.config.url,
      }];
    } finally {
      clearTimeout(timeout);
    }
  }

  async getSample(n = 5) {
    if (Array.isArray(this.config.mockData) && this.config.mockData.length > 0) {
      return this.config.mockData.slice(0, n);
    }

    const fetched = await this._fetchSample();
    if (Array.isArray(fetched) && fetched.length > 0) {
      return fetched.slice(0, n);
    }

    // Preview-safe fallback: synthetic row when no URL or data available.
    return [{
      _preview: true,
      _warning: 'API preview returned synthetic sample. Provide mockData or a reachable URL.',
      url: this.config.url || null,
      method: String(this.config.method || 'GET').toUpperCase(),
      data_path: this.config.data_path,
    }];
  }
}

module.exports = APIDatasetRuntime;
