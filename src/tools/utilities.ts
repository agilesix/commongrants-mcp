/**
 * Utility tools for health checks and version comparison
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../services/api-client.js";
import { OpenAPIParser } from "../services/openapi-parser.js";

export function registerUtilityTools(server: McpServer) {
	/**
	 * Check API health endpoint
	 */
	server.tool(
		"check_api_health",
		"Checks the health status of an API",
		{
			apiId: z.string().describe("The API ID"),
			healthCheckUrl: z.string().optional().describe("Optional: custom health check URL (if not in metadata)"),
		},
		async ({ apiId, healthCheckUrl }) => {
			try {
				let url = healthCheckUrl;

				// If no URL provided, try to get from metadata
				if (!url) {
					const metadata = await ApiClient.getApiMetadata(apiId);
					url = metadata.healthCheck;
				}

				if (!url) {
					return {
						content: [
							{
								type: "text",
								text: `No health check URL found for API: ${apiId}. Please provide a healthCheckUrl parameter.`,
							},
						],
						isError: true,
					};
				}

				const health = await ApiClient.checkHealth(url);

				const output = [
					`Health Check: ${apiId}`,
					`URL: ${url}`,
					`Status: ${health.status}`,
					`Timestamp: ${health.timestamp}`,
					"",
				];

				if (health.details) {
					output.push("Details:");
					output.push(JSON.stringify(health.details, null, 2));
				}

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error checking health: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);

	/**
	 * Compare two versions of an API
	 */
	server.tool(
		"compare_api_versions",
		"Compares two versions of an API",
		{
			apiId: z.string().describe("The API ID"),
			version1: z.string().describe("First version to compare (e.g., 'v1')"),
			version2: z.string().describe("Second version to compare (e.g., 'v2')"),
		},
		async ({ apiId, version1, version2 }) => {
			try {
				// Fetch both specs
				const [spec1, spec2] = await Promise.all([
					ApiClient.getOpenApiSpec(apiId, version1),
					ApiClient.getOpenApiSpec(apiId, version2),
				]);

				const parser1 = new OpenAPIParser(spec1);
				const parser2 = new OpenAPIParser(spec2);

				// Get endpoints for both versions
				const [endpoints1, endpoints2] = await Promise.all([
					parser1.listEndpoints(),
					parser2.listEndpoints(),
				]);

				// Get schemas for both versions
				const [schemas1, schemas2] = await Promise.all([parser1.listSchemas(), parser2.listSchemas()]);

				// Build endpoint maps
				const endpointMap1 = new Map(
					endpoints1.map((e) => [`${e.method} ${e.path}`, e]),
				);
				const endpointMap2 = new Map(
					endpoints2.map((e) => [`${e.method} ${e.path}`, e]),
				);

				// Find added, removed, and potentially modified endpoints
				const endpointsAdded: string[] = [];
				const endpointsRemoved: string[] = [];
				const endpointsModified: Array<{ path: string; method: string; changes: string[] }> = [];

				// Check for added endpoints
				for (const key of endpointMap2.keys()) {
					if (!endpointMap1.has(key)) {
						endpointsAdded.push(key);
					} else {
						// Check if modified
						const e1 = endpointMap1.get(key)!;
						const e2 = endpointMap2.get(key)!;
						const changes: string[] = [];

						if (e1.summary !== e2.summary) {
							changes.push("Summary changed");
						}

						if (e1.deprecated !== e2.deprecated) {
							changes.push(e2.deprecated ? "Marked as deprecated" : "No longer deprecated");
						}

						if (changes.length > 0) {
							endpointsModified.push({
								path: e2.path,
								method: e2.method,
								changes,
							});
						}
					}
				}

				// Check for removed endpoints
				for (const key of endpointMap1.keys()) {
					if (!endpointMap2.has(key)) {
						endpointsRemoved.push(key);
					}
				}

				// Build schema maps
				const schemaMap1 = new Map(schemas1.map((s) => [s.name, s]));
				const schemaMap2 = new Map(schemas2.map((s) => [s.name, s]));

				// Find added, removed schemas
				const schemasAdded: string[] = [];
				const schemasRemoved: string[] = [];
				const schemasModified: string[] = [];

				for (const name of schemaMap2.keys()) {
					if (!schemaMap1.has(name)) {
						schemasAdded.push(name);
					} else {
						// Simple check - just see if properties changed
						const s1 = schemaMap1.get(name)!;
						const s2 = schemaMap2.get(name)!;

						const props1 = (s1.properties || []).sort().join(",");
						const props2 = (s2.properties || []).sort().join(",");

						if (props1 !== props2) {
							schemasModified.push(name);
						}
					}
				}

				for (const name of schemaMap1.keys()) {
					if (!schemaMap2.has(name)) {
						schemasRemoved.push(name);
					}
				}

				// Build output
				const output = [
					`API Version Comparison: ${apiId}`,
					`Comparing ${version1} → ${version2}`,
					"",
				];

				// Endpoints summary
				output.push("Endpoint Changes:");
				output.push(`  Added: ${endpointsAdded.length}`);
				output.push(`  Removed: ${endpointsRemoved.length}`);
				output.push(`  Modified: ${endpointsModified.length}`);
				output.push("");

				if (endpointsAdded.length > 0) {
					output.push("Endpoints Added:");
					for (const endpoint of endpointsAdded) {
						output.push(`  + ${endpoint}`);
					}
					output.push("");
				}

				if (endpointsRemoved.length > 0) {
					output.push("Endpoints Removed:");
					for (const endpoint of endpointsRemoved) {
						output.push(`  - ${endpoint}`);
					}
					output.push("");
				}

				if (endpointsModified.length > 0) {
					output.push("Endpoints Modified:");
					for (const endpoint of endpointsModified) {
						output.push(`  ~ ${endpoint.method} ${endpoint.path}`);
						for (const change of endpoint.changes) {
							output.push(`    • ${change}`);
						}
					}
					output.push("");
				}

				// Schemas summary
				output.push("Schema Changes:");
				output.push(`  Added: ${schemasAdded.length}`);
				output.push(`  Removed: ${schemasRemoved.length}`);
				output.push(`  Modified: ${schemasModified.length}`);
				output.push("");

				if (schemasAdded.length > 0) {
					output.push("Schemas Added:");
					for (const schema of schemasAdded) {
						output.push(`  + ${schema}`);
					}
					output.push("");
				}

				if (schemasRemoved.length > 0) {
					output.push("Schemas Removed:");
					for (const schema of schemasRemoved) {
						output.push(`  - ${schema}`);
					}
					output.push("");
				}

				if (schemasModified.length > 0) {
					output.push("Schemas Modified:");
					for (const schema of schemasModified) {
						output.push(`  ~ ${schema}`);
					}
					output.push("");
				}

				// Summary
				const totalChanges =
					endpointsAdded.length +
					endpointsRemoved.length +
					endpointsModified.length +
					schemasAdded.length +
					schemasRemoved.length +
					schemasModified.length;

				output.push(
					totalChanges === 0
						? "No significant changes detected between versions."
						: `Total changes: ${totalChanges}`,
				);

				return {
					content: [{ type: "text", text: output.join("\n") }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error comparing versions: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		},
	);
}
