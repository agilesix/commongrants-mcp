# CommonGrants MCP Server

Model Context Protocol server for progressive discovery and validation of CommonGrants APIs. Built on Cloudflare Workers with TypeScript and Zod validation.

## Features

**13 MCP Tools** across 4 categories:

- **Discovery** (2): List API versions, get version metadata
- **Exploration** (5): Summarize APIs, browse endpoints, search operations, view schemas
- **Validation** (4): Validate payloads, generate examples, get validation rules (Zod-based)
- **Utilities** (2): Check health, compare versions

## Supported API Versions

- **v0.3.0** (latest) - Latest version with expanded endpoints
- **v0.2.0** (stable) - Stable version

## Architecture

```
┌─────────────────────────────────────────┐
│  13 MCP Tools (4 categories)            │
├─────────────────────────────────────────┤
│  • Cache (LRU, 1hr TTL)                 │
│  • API Client (CommonGrants)            │
│  • OpenAPI Parser (@scalar, YAML)       │
│  • Validator (Zod)                      │
├─────────────────────────────────────────┤
│  Cloudflare Workers Runtime             │
└─────────────────────────────────────────┘
```

## Tools

**Discovery** (2)
- `list_commongrants_apis` - List all API versions
- `get_api_version_info` - Get version metadata

**Exploration** (5)
- `get_api_summary` - API overview
- `list_api_endpoints` - List endpoints with filters
- `get_endpoint_details` - Endpoint specification
- `get_api_schemas` - Data model schemas
- `search_api_operations` - Search operations

**Validation** (4)
- `validate_request_payload` - Validate requests
- `validate_response_payload` - Validate responses
- `generate_example_payload` - Generate examples
- `get_validation_rules` - Validation rules

**Utilities** (2)
- `check_api_health` - Health checks
- `compare_api_versions` - Version comparison

## Quick Start

```bash
# Install
npm install

# Start server
npm run dev

# Run tests
npm run test:all

# Deploy
npm run deploy
```

Server runs at `http://localhost:8788/sse`

## Testing

**Unit Tests**
```bash
npm run test:unit
```

**Integration Tests**
```bash
npm run dev              # Terminal 1
npm run test:integration # Terminal 2
```

**All Tests**
```bash
npm run test:all
```

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
# Open http://localhost:5173
# Connect to http://localhost:8788/sse
```

## Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "commongrants": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8788/sse"]
    }
  }
}
```

For production, use `https://commongrants-mcp.<your-account>.workers.dev/sse`

## Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript 5.9
- **MCP**: @modelcontextprotocol/sdk 1.19
- **Validation**: Zod 3.25
- **Parser**: @scalar/openapi-parser 0.22 (with YAML support)
- **YAML**: js-yaml 4.1
- **Testing**: Vitest 3.2

### Caching
- LRU cache with 1hr TTL (max 50 items)
- Automatic cleanup of expired entries

### Data Sources
- CommonGrants v0.3.0: `https://commongrants.org/openapi/openapi.0.3.0.yaml`
- CommonGrants v0.2.0: `https://commongrants.org/openapi/openapi.0.2.0.yaml`

## Project Structure

```
src/
├── index.ts              # MCP server
├── config/               # CommonGrants API configuration
├── services/             # Cache, API client, parser, validator (Zod)
├── tools/                # 13 MCP tools (4 files)
└── utils/                # Error formatting, example generation
test/
├── unit/                 # Unit tests (Workers pool)
└── integration/          # Integration tests (Node.js + HTTP)
```

## Resources

- [CommonGrants Protocol](https://commongrants.org/protocol/)
- [CommonGrants API Documentation](https://commongrants.org/protocol/api-docs/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)

## License

MIT
