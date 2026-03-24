# Nexus RPC Code Generator

`nexus-rpc-gen` generates code from NexusRPC definition files containing services and types.

⚠️ UNDER ACTIVE DEVELOPMENT

This generator is under active development and has not released a stable version yet. Command line options may change in
incompatible ways until the generator is marked stable.

## Installation

This generator is under active development, but the alpha version is available with npx.

```bash
npx nexus-rpc-gen@alpha
```

This generator can also be built locally with latest stable Node.js from the `src` directory:

```bash
pnpm install && pnpm run build
```

Then run via `pnpm tsx src/packages/nexus-rpc-gen/src/index.ts`.

## Usage

To generate TypeScript code from a definition file:

```bash
nexus-rpc-gen --lang ts --out-file my-out-file.ts my-service.nexusrpc.yaml
```

This will generate a `my-out-file.ts` code file from the given YAML definition file. See [samples](samples) for what
output may look like in different languages.

<!-- BEGIN GENERATED HELP -->
```

Synopsis

  $ nexus-rpc-gen [--lang LANG] [--out FILE/DIR] SCHEMA_FILE|URL ... 
                                                                     
  LANG ... cs|go|java|py|ts                                          

Description

  Generate code from Nexus RPC definition file. 

Options

 -h, --help                                                  Display help.                                              
 --lang string                                               The target language.                                       
 --out-dir string                                            Out directory. Mutually exclusive with --out-file.         
 --out-file string                                           Out file. Mutually exclusive with --out-dir.               
 --dry-run                                                   Dump every file that would be written to stdout instead.   
```

Some languages have additional options. Run `nexus-rpc-gen --help` for the full list.
<!-- END GENERATED HELP -->

## Definition File

Nexus definition files are YAML files that contain any number of services or types. Nexus definition files are usually
expected to have the `.nexusrpc.yaml` file extension.

A definition file looks like this (with added clarifying comments):

```yaml
# Required and must be 1.0.0 at this time
nexusrpc: 1.0.0

# Set of Nexus services, as keys
services:
  # Name of the Nexus service
  UserService:
    # Description of the Nexus service
    description: A service for managing users.
    # Set of Nexus operations for the service, as keys
    operations:
      # Name of the operation
      getUser:
        # Description of the operation
        description: Get a user.
        # Input and output types, often as JSON schema, and often as a "$ref" to
        # the "types" section
        input:
          $ref: '#/types/GetUserInput'
        output:
          $ref: '#/types/GetUserOutput'

# Arbitrary JSON schema
types:
  GetUserInput:
    type: object
    additionalProperties: false
    properties:
      userId: { type: string }
    required: [userId]
  GetUserOutput:
    type: object
    additionalProperties: false
    properties:
      user: { $ref: '#/types/User' }
    required: [user]
  User:
    type: object
    additionalProperties: false
    properties:
      userId: { type: string }
      email: { type: string }
```

### Operation Input/Output Types

Operations have optional `input` and `output` types. For operations that do not have `input` or do not have `output`,
either or both may be omitted. These types are usually clearest as simple `$ref`s to objects defined in the `types`
section. Users are strongly encouraged to make an `object` type for each operation `input` and `output` in the `types`
section. This provides a future-proof way to extend the input/output with more non-required properties.

In addition to regular JSON schema, the top-level `input` and `output` types can instead have a `$<lang>Ref` key where
`<lang>` is `csharp`, `go`, `java`, `python`, or `typescript`. If a matching `$<lang>Ref` is present for the language
being generated, that type is used directly (with the appropriate import) instead of generating the JSON schema type.
If no `$<lang>Ref` matches, the `$ref` value is used as a fallback. This is useful for referencing types that already
exist in your codebase.

The format for qualifying a type differs per language — see the [schema](schemas/nexus-rpc-gen.yml) for details and the
[inventory-service sample](samples/inventory-service) for a full working example.

### IDE Support

A schema file for the YAML is at [schemas/nexus-rpc-gen.json](schemas/nexus-rpc-gen.json) and can be used with editors
to get autocomplete and validation of Nexus YAML files.

For example, in VSCode, add the following to your user settings JSON:

```json
{
    "yaml.schemas": {
        "https://raw.githubusercontent.com/nexus-rpc/nexus-rpc-gen/refs/heads/main/schemas/nexus-rpc-gen.json": [
            "**/*.nexusrpc.yaml"
        ]
    }
}
```

This will provide autocomplete and validation for all `.nexusrpc.yaml` files.

## Development

### Schema

The definition file schemas are in [schemas](schemas). To adjust, alter the `nexus-rpc-gen.yml` file and run
`pnpm run build:schema` from the `src` directory. May want to `pnpm run lint:fix` afterwards.

### Tests

Tests are in their own package at [src/packages/nexus-rpc-gen-tests](src/packages/nexus-rpc-gen-tests). The following
system dependencies must be installed to run them (ideally latest stable versions):

* .NET, with `dotnet` on the `PATH`
* Go, with `go` on the `PATH`
* Java
* Python and `uv`, with `uv` on the `PATH`

That's in addition to nodejs needed to build. Then to test, this can be run from `src`:

```bash
pnpm run build && pnpm run test
```

### Build Single Binary

`nexus-rpc-gen` can also be packaged as a single binary using [Bun](https://bun.com/docs/bundler/executables).

```bash
pnpm install --frozen-lockfile && pnpm run build && bun build packages/nexus-rpc-gen/src/index.ts --compile --outfile bin/nexus-rpc-gen
```

The resulting single binary will be in `src/bin/nexus-rpc-gen`.

### Releasing

Use the `initiate-release.mjs` script to start a release. Run from the repository root:

```bash
node scripts/initiate-release.mjs --version 1.0.0 --type ga
node scripts/initiate-release.mjs --version 1.1.0-rc.1 --type rc
node scripts/initiate-release.mjs --version 1.1.0-beta.1 --type beta --branch main
```

The script bumps versions, opens a PR, waits for merge, and triggers the `prepare-release` workflow
which builds binaries and creates a draft GitHub release. After reviewing and publishing the draft release,
npm packages are published automatically.
