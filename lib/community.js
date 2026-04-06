/**
 * Community related pipeline operations
 */

/**
 * Forks a community pipeline to the user's dashboard
 * @param {Object} supabase Supabase client
 * @param {string} userId User ID who is forking
 * @param {Object} pipeline Original pipeline object
 * @returns {Promise<Object>} The new forked pipeline
 */
export const forkPipeline = async (supabase, userId, pipeline) => {
	if (!userId) throw new Error('User ID is required to fork a pipeline');

	// 1. Insert the new pipeline copy
	const { data, error } = await supabase
		.from('pipelines')
		.insert({
			user_id: userId,
			name: `${pipeline.name || 'Community Pipeline'} (Forked)`,
			nodes: pipeline.nodes || [],
			edges: pipeline.edges || [],
			is_public: false,
			description: pipeline.description,
			parent_id: pipeline.id, // Track inheritance
			original_folder: null // Forks go to root level by default
		})
		.select()
		.single();

	if (error) throw error;

	// 2. Increment fork count on the original pipeline via RPC
	const { error: rpcError } = await supabase.rpc('increment_fork_count', { row_id: pipeline.id });
	
	// We don't necessarily want to fail the whole operation if the RPC fails, 
	// but for a strict unit test we should track it.
	if (rpcError) console.error('Failed to increment fork count:', rpcError);

	return data;
};

/**
 * Publishes or updates a pipeline in the community gallery
 * Creates a separate "Snapshot" copy so community viewers don't interfere with the live workspace
 * @param {Object} supabase Supabase client
 * @param {Object} sourcePipeline Original working-set pipeline object
 * @param {Object} metadata Metadata for publishing (description, tags)
 * @returns {Promise<Object>} The published snapshot pipeline
 */
export const publishToCommunity = async (supabase, sourcePipeline, { description, tags }) => {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Authentication required to publish to community');

	const parsedTags = Array.isArray(tags) ? tags : (tags || '').split(',').map(t => t.trim()).filter(Boolean);

	// 1. Check if a public snapshot already exists for this pipeline
	const { data: existingSnapshot } = await supabase
		.from('pipelines')
		.select('id, version')
		.eq('parent_id', sourcePipeline.id)
		.eq('is_snapshot', true)
		.maybeSingle();

	const nextVersion = existingSnapshot ? (existingSnapshot.version || 1) + 1 : 1;

	const payload = {
		user_id: user.id,
		name: sourcePipeline.name || 'Community Pipeline',
		nodes: sourcePipeline.nodes || [],
		edges: sourcePipeline.edges || [],
		is_public: true,
		is_snapshot: true,
		parent_id: sourcePipeline.id,
		description: description || '',
		tags: parsedTags,
		version: nextVersion,
		updated_at: new Date().toISOString()
	};

	if (existingSnapshot) {
		// Update existing snapshot
		const { data, error } = await supabase
			.from('pipelines')
			.update(payload)
			.eq('id', existingSnapshot.id)
			.select()
			.single();

		if (error) throw error;
		return data;
	} else {
		// Create new snapshot
		const { data, error } = await supabase
			.from('pipelines')
			.insert(payload)
			.select()
			.single();

		if (error) throw error;
		return data;
	}
};
