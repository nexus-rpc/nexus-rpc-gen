# Inventory Service

An inventory tracking service demonstrating language-specific type references (`$langRef`).

Some operations reference pre-existing types in specific languages via `$langRef` keys (e.g.
`$goRef`, `$javaRef`), while others fall back to types generated from the `$ref` definition.

Here is how the code was generated for each language from this directory:

### C#

```
nexus-rpc-gen --lang cs --out-file generated-cs/InventoryService.cs inventory-service.nexusrpc.yaml
```

### Go

```
nexus-rpc-gen --lang go --out-file generated-go/inventory_service.go inventory-service.nexusrpc.yaml
```

### Java

```
nexus-rpc-gen --lang java --out-dir generated-java inventory-service.nexusrpc.yaml
```

### Python

```
nexus-rpc-gen --lang py --out-file generated-py/inventory_service.py inventory-service.nexusrpc.yaml
```

### TypeScript

```
nexus-rpc-gen --lang ts --out-file generated-ts/inventory-service.ts inventory-service.nexusrpc.yaml
```
