package com.example.nexusservices;

import io.nexusrpc.Operation;
import io.nexusrpc.Service;

@Service
public interface DateService {
  @Operation
  void dateOperation(DateInput input);
}
