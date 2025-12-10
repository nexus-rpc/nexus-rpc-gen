These are JSON schemas representing the NexusRPC definition files. Files in this dir:

* `nexus-rpc-gen.yml` - The schema in YAML format. This is the only schema that should be edited.
* `nexus-rpc-gen.json` - JSON form of the YAML generated via `npm run build:schema` at the root.
* `nexus-rpc-gen.loose.json` - Looser JSON form of the YAML generated via `npm run build:schema` at the root. This
  doesn't reference JSON schema spec.