import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerExplorationTools } from "./tools/exploration.js";
import { registerValidationTools } from "./tools/validation.js";
import { registerUtilityTools } from "./tools/utilities.js";

/**
 * CommonGrants API MCP Server
 *
 * A Model Context Protocol (MCP) server that provides AI assistants with tools
 * to discover, explore, and validate CommonGrants APIs.
 *
 * ## Tool Categories
 *
 * - **Discovery** (2 tools): List API versions and get version metadata
 * - **Exploration** (5 tools): Browse endpoints, search operations, view schemas
 * - **Validation** (4 tools): Validate payloads with Zod, generate examples
 * - **Utilities** (2 tools): Health checks and version comparison
 *
 * @see https://commongrants.org/protocol/ for CommonGrants protocol documentation
 * @see https://modelcontextprotocol.io/ for MCP specification
 */
export class CommonGrantsMCP extends McpAgent<Env> {
	server = new McpServer({
		name: "CommonGrants API",
		version: "1.0.0",
	});

	async init() {
		// Register all tool categories
		registerDiscoveryTools(this.server);
		registerExplorationTools(this.server);
		registerValidationTools(this.server);
		registerUtilityTools(this.server);

		console.log("CommonGrants API MCP Server initialized");
		console.log("Available tool categories:");
		console.log("  • Discovery: list_commongrants_apis, get_api_version_info");
		console.log("  • Exploration: get_api_summary, list_api_endpoints, get_endpoint_details, get_api_schemas, search_api_operations");
		console.log("  • Validation: validate_request_payload, validate_response_payload, generate_example_payload, get_validation_rules");
		console.log("  • Utilities: check_api_health, compare_api_versions");
	}
}

/**
 * Cloudflare Worker fetch handler
 *
 * Routes incoming requests to the appropriate MCP endpoints:
 * - `/sse` or `/sse/message`: Server-Sent Events for streaming responses
 * - `/mcp`: Standard MCP JSON-RPC endpoint
 * - All other paths: 404 Not Found
 *
 * @param request - Incoming HTTP request
 * @param env - Cloudflare Worker environment bindings
 * @param ctx - Execution context for the worker
 * @returns Promise resolving to HTTP response
 */
export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Route Server-Sent Events for streaming responses
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return CommonGrantsMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		// Route standard MCP JSON-RPC requests
		if (url.pathname === "/mcp") {
			return CommonGrantsMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Return 404 for all other paths
		return new Response("Not found", { status: 404 });
	},
};
