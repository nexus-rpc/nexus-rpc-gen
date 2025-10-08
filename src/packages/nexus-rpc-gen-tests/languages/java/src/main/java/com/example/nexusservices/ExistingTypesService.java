package com.example.nexusservices;

import io.nexusrpc.Operation;
import io.nexusrpc.Service;

@Service
public interface ExistingTypesService {
  @Operation
  ComplexOutput specificTypesForSomeLangs(com.example.MyExistingType input);

  @Operation
  com.example.MyExistingType.MyExistingNestedType specificTypesForOtherLangs(ComplexInput input);
}
