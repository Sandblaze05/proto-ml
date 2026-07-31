import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePath, listUploads, inspectCsv, validateCsvJoins, deleteUpload } from '@/lib/datasetClient';

describe('Dataset Client', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  describe('validatePath', () => {
    it('should POST to /api/datasets/validate with the path', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

      await validatePath('data/uploads/myfile.csv');

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'data/uploads/myfile.csv' }),
      });
    });

    it('should return the parsed JSON response', async () => {
      const mockResponse = { ok: true, exists: true, isDirectory: false, isFile: true };
      fetchMock.mockResolvedValue({ json: () => Promise.resolve(mockResponse) });

      const result = await validatePath('data/uploads/test.csv');

      expect(result).toEqual(mockResponse);
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(validatePath('data/uploads/test.csv')).rejects.toThrow('Network error');
    });
  });

  describe('listUploads', () => {
    it('should POST to /api/datasets/list with an empty body', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true, datasets: [] }) });

      await listUploads();

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });

    it('should return the parsed JSON response', async () => {
      const mockResponse = { ok: true, datasets: [{ id: 'ds1', path: 'data/uploads/ds1' }] };
      fetchMock.mockResolvedValue({ json: () => Promise.resolve(mockResponse) });

      const result = await listUploads();

      expect(result).toEqual(mockResponse);
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(listUploads()).rejects.toThrow('Network error');
    });
  });

  describe('inspectCsv', () => {
    it('should POST to /api/datasets/inspect with the payload', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

      const payload = { path: 'data/uploads/test.csv', header: true };
      await inspectCsv(payload);

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('should POST with an empty object when payload is falsy', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

      await inspectCsv(null);

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });

    it('should return the parsed JSON response', async () => {
      const mockResponse = { ok: true, columns: ['a', 'b'], rows: [{ a: '1', b: '2' }] };
      fetchMock.mockResolvedValue({ json: () => Promise.resolve(mockResponse) });

      const result = await inspectCsv({ path: 'data/uploads/test.csv' });

      expect(result).toEqual(mockResponse);
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(inspectCsv({ path: 'data/uploads/test.csv' })).rejects.toThrow('Network error');
    });
  });

  describe('validateCsvJoins', () => {
    it('should POST to /api/datasets/joins with the payload', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true, valid: true }) });

      const payload = { primary: 'table1', relations: [{ left: 'table1', right: 'table2', on: 'id' }] };
      await validateCsvJoins(payload);

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/joins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('should POST with an empty object when payload is falsy', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

      await validateCsvJoins(null);

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/joins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });

    it('should return the parsed JSON response', async () => {
      const mockResponse = { ok: true, valid: true, suggestions: [], validation: [] };
      fetchMock.mockResolvedValue({ json: () => Promise.resolve(mockResponse) });

      const result = await validateCsvJoins({ primary: 'table1' });

      expect(result).toEqual(mockResponse);
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(validateCsvJoins({ primary: 'table1' })).rejects.toThrow('Network error');
    });
  });

  describe('deleteUpload', () => {
    it('should POST to /api/datasets/delete with the path', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

      await deleteUpload('data/uploads/old.csv');

      expect(fetchMock).toHaveBeenCalledWith('/api/datasets/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'data/uploads/old.csv' }),
      });
    });

    it('should return the parsed JSON response', async () => {
      const mockResponse = { ok: true };
      fetchMock.mockResolvedValue({ json: () => Promise.resolve(mockResponse) });

      const result = await deleteUpload('data/uploads/old.csv');

      expect(result).toEqual(mockResponse);
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      await expect(deleteUpload('data/uploads/old.csv')).rejects.toThrow('Network error');
    });
  });
});