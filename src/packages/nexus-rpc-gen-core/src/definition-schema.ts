/* eslint-disable */
// ⚠️ This file is generated. Do not edit manually.

/**
 * Definition for Nexus RPC services and operations
 */
export interface DefinitionSchema {
    nexusrpc:  string;
    services?: { [key: string]: ServiceValue };
    types?:    { [key: string]: { [key: string]: any } };
}

export interface ServiceValue {
    description?: string;
    operations:   { [key: string]: OperationValue };
}

export interface OperationValue {
    description?: string;
    input?:       { [key: string]: any };
    output?:      { [key: string]: any };
}
