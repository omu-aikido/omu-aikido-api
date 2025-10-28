# My App Development Guidelines

## Hono Development

Use the `hono` CLI for efficient development. View all commands with `hono --help`.

### Core Commands

- **`hono docs [path]`** - Browse Hono documentation
- **`hono search <query>`** - Search documentation
- **`hono request [file]`** - Test app requests without starting a server

### Quick Examples

```bash
# Search for topics
hono search middleware
hono search "getting started"

# View documentation
hono docs /docs/api/context
hono docs /docs/guides/middleware

# Test your app
hono request -P /api/users src/index.ts
hono request -P /api/users -X POST -d '{"name":"Alice"}' src/index.ts
```

### Workflow

1. Search documentation: `hono search <query>`
2. Read relevant docs: `hono docs [path]`
3. Test implementation: `hono request [file]`
