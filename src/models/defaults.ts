/**
 * Defaults types for Content Understanding resource configuration.
 * Represents default model deployment mappings.
 */

/**
 * Model deployment mappings.
 * Maps model names to deployment names.
 * Example: { "gpt-4.1": "myGpt41Deployment", "text-embedding-3-large": "myEmbeddingDeployment" }
 */
export type ModelDeployments = Record<string, string>;

/**
 * Content Understanding defaults configuration.
 */
export interface ContentUnderstandingDefaults {
  /** Mapping of model names to deployment names */
  modelDeployments: ModelDeployments;
}

/**
 * Request to update defaults (merge-patch).
 * Only specified model mappings are updated; others are preserved.
 */
export interface UpdateDefaultsRequest {
  /** Mapping of model names to deployment names to update */
  modelDeployments: ModelDeployments;
}

/**
 * API response for defaults.
 */
export interface DefaultsApiResponse {
  modelDeployments: Record<string, string>;
}
