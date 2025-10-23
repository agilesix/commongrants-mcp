# Testing CommonGrants MCP Server

## Quick Test with MCP Inspector

The best way to test the MCP server is using the official MCP Inspector:

### 1. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:8788`

### 2. Launch MCP Inspector

In a new terminal:

```bash
npx @modelcontextprotocol/inspector@latest
```

This will open the MCP Inspector at `http://localhost:5173`

### 3. Connect to the Server

In the MCP Inspector:
1. Enter the server URL: `http://localhost:8788/sse`
2. Click "Connect"
3. You should see the server initialize and list all available tools

### 4. Test Common Grants Tools

Try these tools in order:

#### Discovery Tools
1. **list_commongrants_apis** - Lists available API versions (v0.2.0, v0.3.0)
2. **get_api_version_info** - Get details for a specific version
   - `apiId`: `commongrants-0.3.0`

#### Exploration Tools
3. **get_api_summary** - Get an overview of the API
   - `apiId`: `commongrants-0.3.0`
   - `version`: `0.3.0`

4. **list_api_endpoints** - List all endpoints
   - `apiId`: `commongrants-0.3.0`
   - `version`: `0.3.0`

#### Validation Tools
5. **generate_example_payload** - Generate example request
   - `apiId`: `commongrants-0.3.0`
   - `version`: `0.3.0`
   - `path`: (use a path from list_api_endpoints)
   - `method`: `GET` or `POST`

## Unit Tests

Run the unit test suite:

```bash
npm run test:unit
```

Expected: **132 tests passing**

## Integration Tests (Optional)

Integration tests require the server to be running and test the actual CommonGrants OpenAPI specs:

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run test:integration
```

**Note**: Integration tests may fail if:
- CommonGrants API is unreachable
- YAML specs change format
- Network issues

## Type Checking

Verify TypeScript compilation:

```bash
npm run type-check
```

Should complete with no errors.

## What Should Work

✅ **Server starts** on localhost:8788
✅ **MCP Inspector** can connect and initialize
✅ **13 tools** are listed and callable
✅ **YAML parsing** works for CommonGrants specs
✅ **Discovery tools** return v0.2.0 and v0.3.0
✅ **Exploration tools** parse and display endpoints
✅ **Validation tools** work with Zod schemas

## Deployment Test

To test before deploying to Cloudflare:

```bash
npm run deploy --dry-run
```

Or deploy to preview:

```bash
wrangler deploy --dry-run
```

## Troubleshooting

### Server won't start
- Check port 8788 isn't in use: `lsof -i :8788`
- Try: `rm -rf .wrangler && npm run dev`

### MCP Inspector won't connect
- Verify server is running: Check terminal for "Ready on http://localhost:8788"
- Use exact URL: `http://localhost:8788/sse` (not https, not /mcp)

### Tools return errors
- Check CommonGrants API is accessible: `curl https://commongrants.org/openapi/openapi.0.3.0.yaml`
- Clear cache and restart server

## CI/CD Testing

For automated testing in CI/CD:

```bash
# Run all checks
npm run type-check && npm run test:unit
```

This validates:
- TypeScript compiles correctly
- Core functionality works
- No regressions in utilities

---

**Recommended Testing Flow**:
1. Type check → Unit tests → Start server → MCP Inspector → Deploy
