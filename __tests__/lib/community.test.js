import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forkPipeline, publishToCommunity } from '@/lib/community';

describe('Community Pipeline Features', () => {
	let mockSupabase;
	const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
	const mockPipelineId = '987f6543-e21b-78d3-a456-426614174999';

	const mockPipeline = {
		id: mockPipelineId,
		name: 'Original Pipeline',
		nodes: [{ id: '1', type: 'text' }],
		edges: [{ id: 'e1', source: '1', target: '2' }],
		is_public: true,
		description: 'A great pipeline',
		version: 1,
		fork_count: 0
	};

	beforeEach(() => {
		// Create a clean mock for each test
		mockSupabase = {
			auth: {
				getUser: vi.fn().mockResolvedValue({ 
					data: { user: { id: mockUserId, email: 'test@example.com' } }, 
					error: null 
				})
			},
			from: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			single: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			rpc: vi.fn().mockResolvedValue({ error: null })
		};
	});

	describe('forkPipeline', () => {
		it('should correctly insert a new pipeline and increment fork count', async () => {
			const forkedData = { ...mockPipeline, id: 'new-id', user_id: mockUserId, parent_id: mockPipelineId };
			mockSupabase.single.mockResolvedValueOnce({ data: forkedData, error: null });

			const result = await forkPipeline(mockSupabase, mockUserId, mockPipeline);

			// Check insertion
			expect(mockSupabase.from).toHaveBeenCalledWith('pipelines');
			expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
				user_id: mockUserId,
				name: 'Original Pipeline (Forked)',
				parent_id: mockPipelineId,
				is_public: false
			}));

			// Check RPC call
			expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_fork_count', { row_id: mockPipelineId });

			// Check final result
			expect(result.id).toBe('new-id');
			expect(result.parent_id).toBe(mockPipelineId);
		});

		it('should throw error if user ID is missing', async () => {
			await expect(forkPipeline(mockSupabase, null, mockPipeline))
				.rejects.toThrow('User ID is required to fork a pipeline');
		});

		it('should throw error if insertion fails', async () => {
			mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

			await expect(forkPipeline(mockSupabase, mockUserId, mockPipeline))
				.rejects.toThrow('DB Error');
		});
	});

	describe('publishToCommunity', () => {
		it('should increment version if a snapshot already exists', async () => {
			// First call for maybeSingle (checking for existing snapshot)
			mockSupabase.maybeSingle.mockResolvedValueOnce({ 
				data: { id: 'snap-id', version: 2 }, 
				error: null 
			});
			// Second call for the actual update/insert response
			mockSupabase.single.mockResolvedValueOnce({ 
				data: { ...mockPipeline, version: 3, is_snapshot: true }, 
				error: null 
			});

			const result = await publishToCommunity(mockSupabase, mockPipeline, {
				description: 'Updated desc',
				tags: 'ai, machine-learning'
			});

			expect(mockSupabase.update).toHaveBeenCalled();
			expect(result.version).toBe(3);
		});

		it('should initialize version to 1 if no previous snapshot exists', async () => {
			// No existing snapshot
			mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
			// New snapshot created
			mockSupabase.single.mockResolvedValueOnce({ 
				data: { ...mockPipeline, version: 1, is_snapshot: true }, 
				error: null 
			});

			const result = await publishToCommunity(mockSupabase, mockPipeline, {
				description: 'Initial publish',
				tags: 'first'
			});

			expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
				version: 1,
				is_snapshot: true
			}));
			expect(result.version).toBe(1);
		});

		it('should correctly parse comma-separated tags', async () => {
			mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
			mockSupabase.single.mockResolvedValueOnce({ data: mockPipeline, error: null });

			await publishToCommunity(mockSupabase, mockPipeline, {
				tags: '  react , flow , logic  '
			});

			expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
				tags: ['react', 'flow', 'logic']
			}));
		});
	});
});
