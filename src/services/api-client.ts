/**
 * API client for fetching CommonGrants API metadata and OpenAPI specs
 */

import yaml from "js-yaml";
import type { ApiMetadata, ApiInfo, ApiVersionInfo, OpenAPISpec, HealthCheckResponse } from "../types/api-types.js";
import { metadataCache, openApiCache } from "./cache.js";
import { COMMONGRANTS_VERSIONS, getAllVersions, getSpecUrl, getVersionInfo } from "../config/commongrants.js";

export class ApiClient {
	/**
	 * List all available CommonGrants API versions
	 */
	static async listApis(): Promise<ApiMetadata[]> {
		// Check cache first
		const cached = metadataCache.get("api-list");
		if (cached) {
			console.log("[API Client] Returning cached API list");
			return cached;
		}

		const startTime = Date.now();
		console.log("[API Client] Listing CommonGrants API versions");

		try {
			const versions = getAllVersions();

			const apis: ApiMetadata[] = versions.map((version) => ({
				id: `commongrants-${version.version}`,
				name: `CommonGrants API v${version.version}`,
				description: version.description,
				versions: [version.version],
				status: version.status === "latest" ? "active" : version.status === "stable" ? "active" : "deprecated",
			}));

			const elapsed = Date.now() - startTime;
			console.log(`[API Client] Listed ${apis.length} API versions in ${elapsed}ms`);

			// Cache the result
			metadataCache.set("api-list", apis);

			return apis;
		} catch (error) {
			console.error("[API Client] Error listing APIs:", error);
			throw new Error(`Error listing APIs: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Get detailed metadata for a specific API version
	 */
	static async getApiMetadata(apiId: string): Promise<ApiInfo> {
		// Check cache first
		const cacheKey = `metadata:${apiId}`;
		const cached = metadataCache.get(cacheKey);
		if (cached) {
			console.log(`[API Client] Returning cached metadata for ${apiId}`);
			return cached;
		}

		console.log(`[API Client] Fetching metadata for: ${apiId}`);

		try {
			// Extract version from apiId (format: "commongrants-X.X.X")
			const version = apiId.replace("commongrants-", "");
			const versionConfig = getVersionInfo(version);

			if (!versionConfig) {
				throw new Error(`Unknown API version: ${version}`);
			}

			// Fetch the OpenAPI spec to get detailed info
			const spec = await this.getOpenApiSpec(apiId, version);

			const metadata: ApiInfo = {
				id: apiId,
				name: spec.info.title || `CommonGrants API v${version}`,
				description: spec.info.description || versionConfig.description,
				versions: [version],
				openApiUrl: versionConfig.specUrl,
				status: versionConfig.status === "latest" || versionConfig.status === "stable" ? "active" : "deprecated",
				documentation: "https://commongrants.org/protocol/",
				contact: spec.info.contact,
				versionDetails: [{
					version,
					baseUrl: spec.servers?.[0]?.url || "",
					openApiUrl: versionConfig.specUrl,
					status: versionConfig.status === "latest" ? "current" : "deprecated",
					isCurrent: versionConfig.status === "latest",
				}],
			};

			console.log(`[API Client] Fetched metadata for ${apiId}:`, {
				name: metadata.name,
				version,
				baseUrl: spec.servers?.[0]?.url,
			});

			// Cache the result
			metadataCache.set(cacheKey, metadata);

			return metadata;
		} catch (error) {
			console.error(`[API Client] Error fetching metadata for ${apiId}:`, error);
			throw new Error(`Error fetching metadata for ${apiId}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Fetch OpenAPI spec for a specific API version
	 * Supports both JSON and YAML formats
	 */
	static async getOpenApiSpec(apiId: string, version: string): Promise<OpenAPISpec> {
		// Check cache first
		const cacheKey = `openapi:${apiId}:${version}`;
		const cached = openApiCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		try {
			const specUrl = getSpecUrl(version);

			if (!specUrl) {
				throw new Error(`No spec URL configured for version: ${version}`);
			}

			console.log(`[API Client] Fetching OpenAPI spec from: ${specUrl}`);
			const response = await fetch(specUrl);

			if (!response.ok) {
				throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
			}

			const contentType = response.headers.get("content-type") || "";
			const text = await response.text();

			let spec: OpenAPISpec;

			// Parse YAML or JSON based on content type or URL extension
			if (contentType.includes("yaml") || contentType.includes("yml") || specUrl.endsWith(".yaml") || specUrl.endsWith(".yml")) {
				console.log(`[API Client] Parsing YAML spec`);
				spec = yaml.load(text) as OpenAPISpec;
			} else {
				console.log(`[API Client] Parsing JSON spec`);
				spec = JSON.parse(text) as OpenAPISpec;
			}

			// Cache the result
			openApiCache.set(cacheKey, spec);

			return spec;
		} catch (error) {
			throw new Error(`Error fetching OpenAPI spec for ${apiId} v${version}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check API health endpoint
	 */
	static async checkHealth(healthCheckUrl: string): Promise<HealthCheckResponse> {
		try {
			const response = await fetch(healthCheckUrl);

			if (!response.ok) {
				return {
					status: "DOWN",
					timestamp: new Date().toISOString(),
					details: {
						statusCode: response.status,
						statusText: response.statusText,
					},
				};
			}

			const data = await response.json() as any;

			// Support multiple health check response formats
			const isHealthy =
				data.status === "UP" ||
				data.success === true ||
				data.default?.success === true;

			return {
				status: isHealthy ? "UP" : "UNKNOWN",
				timestamp: new Date().toISOString(),
				details: data as Record<string, any>,
			};
		} catch (error) {
			return {
				status: "DOWN",
				timestamp: new Date().toISOString(),
				details: {
					error: error instanceof Error ? error.message : String(error),
				},
			};
		}
	}
}
