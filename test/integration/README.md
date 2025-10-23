# Integration Tests

Integration tests for the CommonGrants MCP Server. These tests verify end-to-end functionality by testing the running server via HTTP/MCP protocol.

## Overview

The integration test suite validates all 13 MCP tools through actual server communication:

- **Discovery Tools** (2): API version listing and metadata retrieval
- **Exploration Tools** (5): API summaries, endpoints, schemas, and search
- **Validation Tools** (4): Payload validation with Zod
- **Utility Tools** (2): Health checks and version comparison

## Prerequisites

### 1. Start the Server

Integration tests require a running MCP server:

```bash
npm run dev
```

The server must be available at `http://localhost:8788`.

### 2. Verify Server is Running

Check that the server responds:

```bash
curl http://localhost:8788/health
```

## Running Tests

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test File

```bash
npm run test:integration test/integration/tools/discovery.test.ts
```

### Watch Mode

Run tests in watch mode (auto-rerun on changes):

```bash
npm run test:integration:watch
```

### Run Both Unit and Integration Tests

```bash
npm run test:all
```

## Test Structure

```
test/integration/
├── tools/
│   ├── discovery.test.ts       # 2 discovery tools
│   ├── exploration.test.ts     # 5 exploration tools
│   ├── validation.test.ts      # 4 validation tools (Zod-based)
│   └── utilities.test.ts       # 2 utility tools
├── mcp-protocol.test.ts        # MCP protocol fundamentals
├── comprehensive.test.ts       # All 13 tools in sequence
└── README.md                   # This file
```

## Test Organization

Each test file follows this structure:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { createMCPClient } from "../../helpers/mcp-client.js";

const client = createMCPClient();

describe("Tool Category", () => {
	beforeAll(async () => {
		// Check server and initialize session
		const isAvailable = await client.isServerAvailable();
		if (!isAvailable) {
			throw new Error("MCP server not running");
		}
		await client.initialize();
	});

	describe("specific_tool", () => {
		it("should do something", async () => {
			const result = await client.callTool("tool_name", { args });
			const text = client.getTextContent(result);
			expect(text).toContain("expected content");
		});
	});
});
```

## MCP Client Helper

The `MCPClient` helper class (`test/helpers/mcp-client.ts`) provides:

- **Connection management**: Automatic session handling
- **Request/Response**: JSON-RPC 2.0 protocol
- **SSE parsing**: Server-Sent Events format handling
- **Tool calling**: Simplified tool invocation
- **Error handling**: Graceful error management

### Example Usage

```typescript
import { createMCPClient } from "../helpers/mcp-client.js";

const client = createMCPClient();

// Initialize session
await client.initialize();

// Call a tool
const result = await client.callTool("list_commongrants_apis", {
	includeDeprecated: false,
});

// Get text content
const text = client.getTextContent(result);
console.log(text);
```

## Configuration

Integration tests use a separate Vitest configuration:

**vitest.integration.config.ts**:
- Node.js environment (not Workers pool)
- 30-second test timeout (for network calls)
- Thread pool for parallelization
- v8 coverage provider

## Debugging

### View Detailed Output

```bash
npm run test:integration -- --reporter=verbose
```

### Run Single Test

```bash
npm run test:integration -- -t "should return a list of API versions"
```

### Save Test Logs

Test output can be saved to `test/integration-logs/`:

```bash
npm run test:integration 2>&1 | tee test/integration-logs/test-run-$(date +%Y%m%d-%H%M%S).log
```

## Common Issues

### ❌ "MCP server is not running"

**Solution**: Start the server in another terminal:
```bash
npm run dev
```

### ❌ "Connection refused"

**Solution**: Verify server is on port 8788:
```bash
curl http://localhost:8788/health
```

### ❌ "Timeout"

**Solution**: Network calls may be slow. The timeout is set to 30 seconds. Check your internet connection or CommonGrants API availability.

### ❌ Tests fail sporadically

**Solution**:
- Restart the server: `npm run dev`
- Clear Wrangler cache: `rm -rf .wrangler/`
- Check CommonGrants API health: The tests fetch real OpenAPI specs which may be temporarily unavailable

## Writing New Tests

### 1. Choose the Right File

- **Tool-specific tests**: Add to appropriate `tools/*.test.ts` file
- **Protocol tests**: Add to `mcp-protocol.test.ts`
- **End-to-end tests**: Add to `comprehensive.test.ts`

### 2. Follow the Pattern

```typescript
describe("your_tool_name", () => {
	it("should handle basic usage", async () => {
		const result = await client.callTool("your_tool_name", {
			requiredParam: "value",
		});

		const text = client.getTextContent(result);

		// Assert expected behavior
		expect(text).toContain("expected output");
		expect(text.length).toBeGreaterThan(0);
	});

	it("should handle error cases", async () => {
		try {
			await client.callTool("your_tool_name", {
				invalidParam: "bad value",
			});
		} catch (error) {
			expect(error).toBeDefined();
		}
	});
});
```

### 3. Test Coverage Checklist

- ✅ **Happy path**: Valid inputs produce expected outputs
- ✅ **Edge cases**: Boundary conditions, empty inputs, nulls
- ✅ **Error handling**: Invalid inputs, missing required params
- ✅ **Data validation**: Check structure and content of responses
- ✅ **Performance**: Reasonable timeouts for network operations

## Test Statistics

- **Total Test Files**: 6
- **Total Tests**: ~45-50 integration tests
- **Coverage**: All 13 MCP tools
- **Test Types**: Tool functionality, protocol, error handling, comprehensive

## Differences from Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|------------|-------------------|
| **Scope** | Individual functions | End-to-end workflows |
| **Runtime** | Workers pool (in-memory) | Node.js (HTTP) |
| **Speed** | Fast (~4 seconds) | Slower (~10-30 seconds) |
| **Server** | Not needed | Must be running |
| **Dependencies** | Mocked | Real CommonGrants APIs |
| **Config** | `vitest.config.ts` | `vitest.integration.config.ts` |

## Related Documentation

- **Unit Tests**: See `test/unit/` for isolated function tests
- **MCP Protocol**: See MCP SDK documentation
- **CommonGrants**: See https://commongrants.org/protocol/

## Contributing

When adding new tests:

1. Ensure server is running
2. Follow existing test patterns
3. Add descriptive test names
4. Include error handling tests
5. Run tests before committing: `npm run test:integration`

---

**Last Updated**: 2025-10-23
**Test Framework**: Vitest 3.2.4
**Validation Library**: Zod 3.25.76
