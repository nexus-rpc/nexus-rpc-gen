# User Service

This is a very simple user service with a few operations. Here is how the code was generated for each language from this
directory:

### C#

```
nexus-rpc-gen --lang cs --out-file generated-cs/UserService.cs user-service.nexusrpc.yaml
```

### Go

```
nexus-rpc-gen --lang go --out-file generated-go/user_service.go user-service.nexusrpc.yaml
```

### Java

```
nexus-rpc-gen --lang java --out-dir generated-java user-service.nexusrpc.yaml
```

### Python

```
nexus-rpc-gen --lang py --out-file generated-py/user_service.py user-service.nexusrpc.yaml
```

### TypeScript

```
nexus-rpc-gen --lang ts --out-file generated-ts/user-service.ts user-service.nexusrpc.yaml
```