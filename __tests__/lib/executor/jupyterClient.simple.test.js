import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const JupyterClient = require(join(__dirname, '../../../lib/executor/jupyterClient.js'));

describe('JupyterClient - Unit Tests', () => {
  const baseUrl = 'http://localhost:8888';
  const token = 'test-token-123';

  describe('constructor', () => {
    it('should initialize with baseUrl and token', () => {
      const client = new JupyterClient(baseUrl, token);
      expect(client.baseUrl).toBe(baseUrl);
      expect(client.token).toBe(token);
    });

    it('should trim trailing slashes from baseUrl', () => {
      const client = new JupyterClient('http://localhost:8888///', token);
      expect(client.baseUrl).toBe(baseUrl);
    });

    it('should initialize with empty token if not provided', () => {
      const client = new JupyterClient(baseUrl);
      expect(client.token).toBe('');
    });
  });

  describe('getHeaders', () => {
    it('should include Content-Type header', () => {
      const client = new JupyterClient(baseUrl);
      const headers = client.getHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include Authorization header when token is provided', () => {
      const client = new JupyterClient(baseUrl, token);
      const headers = client.getHeaders();
      expect(headers.Authorization).toBeDefined();
      expect(headers.Authorization.toString()).toContain(token);
    });

    it('should not include Authorization header when token is empty', () => {
      const client = new JupyterClient(baseUrl);
      const headers = client.getHeaders();
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('getFetchOptions', () => {
    it('should return fetch options with GET method by default', async () => {
      const client = new JupyterClient(baseUrl);
      const opts = await client.getFetchOptions();
      expect(opts.method).toBe('GET');
      expect(opts.headers).toBeDefined();
    });

    it('should include POST method when specified', async () => {
      const client = new JupyterClient(baseUrl);
      const opts = await client.getFetchOptions('POST');
      expect(opts.method).toBe('POST');
    });

    it('should serialize body to JSON when provided', async () => {
      const client = new JupyterClient(baseUrl);
      const body = { name: 'python3' };
      const opts = await client.getFetchOptions('POST', body);
      expect(opts.body).toBe(JSON.stringify(body));
    });

    it('should not include body when not provided', async () => {
      const client = new JupyterClient(baseUrl);
      const opts = await client.getFetchOptions('GET');
      expect(opts.body).toBeUndefined();
    });
  });

  describe('uuid', () => {
    it('should generate a UUID-like string', () => {
      const uuid1 = JupyterClient.uuid();
      const uuid2 = JupyterClient.uuid();

      expect(typeof uuid1).toBe('string');
      expect(typeof uuid2).toBe('string');
      expect(uuid1.length).toBeGreaterThan(0);
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('request - with mocked fetch', () => {
    let client;

    beforeEach(() => {
      client = new JupyterClient(baseUrl, token);
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should make a fetch request to correct endpoint', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([]),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await client.request('/api/kernels');
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('localhost:8888/api/kernels');
    });

    it('should append token as query parameter', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([]),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await client.request('/api/kernels');
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain(`token=${encodeURIComponent(token)}`);
    });

    it('should handle successful JSON response', async () => {
      const expectedData = [{ id: 'k1', name: 'python3' }];
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(expectedData),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await client.request('/api/kernels');
      expect(result).toEqual(expectedData);
    });

    it('should return null for 204 No Content', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await client.request('/api/kernels/k1', { method: 'DELETE' });
      expect(result).toBeNull();
    });

    it('should throw error on failed response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Not Found'),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await expect(client.request('/api/kernels/invalid')).rejects.toThrow('Jupyter API Error (404)');
    });
  });

  describe('listKernels', () => {
    let client;

    beforeEach(() => {
      client = new JupyterClient(baseUrl, token);
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call request with /api/kernels endpoint', async () => {
      const kernels = [{ id: 'k1', name: 'python3' }];
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(kernels),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await client.listKernels();
      expect(result).toEqual(kernels);
    });
  });

  describe('startKernel', () => {
    let client;

    beforeEach(() => {
      client = new JupyterClient(baseUrl, token);
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should POST to /api/kernels to start a kernel', async () => {
      const newKernel = { id: 'k-new', name: 'python3' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(newKernel),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await client.startKernel();
      expect(result).toEqual(newKernel);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteKernel', () => {
    let client;

    beforeEach(() => {
      client = new JupyterClient(baseUrl, token);
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should DELETE kernel by id', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await client.deleteKernel('kernel-id');
      expect(result).toBeNull();
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain('/api/kernels/kernel-id');
    });
  });
});
