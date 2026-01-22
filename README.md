# Nexus RPC Code Generator

`nexus-rpc-gen` generates code from NexusRPC definition files containing services and types.

⚠️ UNDER ACTIVE DEVELOPMENT

This generator is under active development and has not released a stable version yet. Command line options may change in
incompatible ways until the generator is marked stable.

## Installation

Since this is under active development, the project must be manually built with latest stable nodejs, e.g. from the
root directory:

```bash
npm install && npm run build
```

Then it it can be run via `node packages/cli/dist/index.js`. The rest of the document assumes this is in
an executable shell file named `nexus-rpc-gen` for non-Windows:

```bash
#!/usr/bin/env sh
node packages/cli/dist/index.js "$@"
```

Or `nexus-rpc-gen.bat` for Windows:

```
@echo off
node packages/cli/dist/index.js %*
```

## Usage

To generate TypeScript code from a definition file:

```bash
nexus-rpc-gen --lang ts --out-file my-out-file.ts my-service.nexusrpc.yaml
```

This will generate a `my-out-file.ts` code file from the given YAML definition file. See [examples](examples) for what
output may look like in different languages.

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
`<lang>` is `csharp`, `go`, `java`, `python`, or `typescript`. If present for the language being generated, that type is
referenced instead of generating the JSON schema type. This can be used to refer to existing types already in a
codebase. The format for qualifying a type for each of these can differ, see the [schema](schemas/nexus-rpc-gen.yml) for
these properties for more details.

### IDE Support

A schema file for the YAML is at [schemas/nexus-rpc-gen.json](schemas/nexus-rpc-gen.json) and can be used with editors
to get intellisense and validation of Nexus YAML files.

For example, in VSCode, the following setting can be set in settings JSON:

```json
{
    "yaml.schemas": {
        "https://raw.githubusercontent.com/nexus-rpc/nexus-rpc-gen/refs/heads/main/schemas/nexus-rpc-gen.json": [
            "**/*.nexusrpc.yaml"
        ]
    }
}
```

This will make all files with `.nexusrpc.yaml` have proper intellisense and validation while editing.

## Development

### Schema

The definition file schemas are in [schemas](schemas). To adjust, alter the `nexus-rpc-gen.yml` file and run
`npm run build:schema` from the root directory. May want to `npm run lint:fix` afterwards.

### Tests

Tests are in their own package at [packages/tests](packages/tests). The following
system dependencies must be installed to run them (ideally latest stable versions):

* .NET, with `dotnet` on the `PATH`
* Go, with `go` on the `PATH`
* Java
* Python and `uv`, with `uv` on the `PATH`

That's in addition to nodejs needed to build. Then to test, this can be run from the root directory:

```bash
npm run build && npm run test
```