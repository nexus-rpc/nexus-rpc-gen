# Inventory Service

An inventory tracking service demonstrating language-specific type references (`$langRef`).

Every operation references pre-existing types in each target language via `$langRef` keys
(`$goRef`, `$javaRef`, etc.) instead of generating type definitions. Each language directory
contains a small set of hand-written models alongside the generated service code.

## Generation commands

### C#

```
nexus-rpc-gen --lang cs --out-file inventory-cs/InventoryService.cs inventory-service.nexusrpc.yaml
```

### Go

```
nexus-rpc-gen --lang go --package services --out-file inventory-go/services/inventory_service.go inventory-service.nexusrpc.yaml
```

### Java

```
nexus-rpc-gen --lang java --out-dir inventory-java inventory-service.nexusrpc.yaml
```

### Python

```
nexus-rpc-gen --lang py --out-file inventory-py/inventory_service.py inventory-service.nexusrpc.yaml
```

### TypeScript

```
nexus-rpc-gen --lang ts --out-file inventory-ts/inventory-service.ts inventory-service.nexusrpc.yaml
```
