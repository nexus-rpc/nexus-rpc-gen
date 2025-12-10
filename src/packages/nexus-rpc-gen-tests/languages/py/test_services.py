import asyncio
from nexusrpc import Content, LazyValue
from nexusrpc.handler import (
    service_handler,
    sync_operation,
    StartOperationContext,
    Handler,
    StartOperationResultSync,
)
from pydantic import TypeAdapter
from typing import Any, Optional
from uuid import uuid4

from services.kitchen_sink import (
    KitchenSinkService,
    ComplexInput,
    ComplexOutput,
    KitchenSinkServiceComplexArgComplexResultInlineInput,
    KitchenSinkServiceComplexArgComplexResultInlineOutput,
)


@service_handler(service=KitchenSinkService)
class KitchenSinkServiceHandler:
    @sync_operation
    async def scalar_arg_scalar_result(
        self, ctx: StartOperationContext, input: str
    ) -> int:
        return len(input)

    @sync_operation
    async def complex_arg_complex_result_inline(
        self,
        ctx: StartOperationContext,
        input: KitchenSinkServiceComplexArgComplexResultInlineInput,
    ) -> KitchenSinkServiceComplexArgComplexResultInlineOutput:
        assert input.string
        return KitchenSinkServiceComplexArgComplexResultInlineOutput(
            character_count=len(input.string)
        )

    @sync_operation
    async def scalar_arg_scalar_result_external(
        self, ctx: StartOperationContext, input: str
    ) -> int:
        raise NotImplementedError

    @sync_operation
    async def complex_arg_complex_result_external(
        self, ctx: StartOperationContext, input: ComplexInput
    ) -> ComplexOutput:
        raise NotImplementedError


async def test_temp():
    # This validates the handler itself
    handler = Handler([KitchenSinkServiceHandler()])

    # We'll also test two method implementations
    scalar_result = await handler.start_operation(
        StartOperationContext(
            service="KitchenSinkService",
            operation="scalarArgScalarResult",
            headers={},
            request_id=str(uuid4()),
        ),
        make_lazy_value('"some string"'),
    )
    assert isinstance(scalar_result, StartOperationResultSync)
    assert scalar_result.value == len("some string")

    complex_result = await handler.start_operation(
        StartOperationContext(
            service="KitchenSinkService",
            operation="complexArgComplexResultInline",
            headers={},
            request_id=str(uuid4()),
        ),
        make_lazy_value('{ "string": "some other string" }'),
    )
    assert isinstance(complex_result, StartOperationResultSync)
    assert (
        complex_result.value
        == KitchenSinkServiceComplexArgComplexResultInlineOutput(
            character_count=len("some other string")
        )
    )


class PydanticSerializer:
    async def serialize(self, value: Any) -> Content:
        return Content(headers={}, data=TypeAdapter(type(value)).dump_json(value))

    async def deserialize(
        self, content: Content, as_type: Optional[type[Any]] = None
    ) -> Any:
        return TypeAdapter(Any if as_type is None else as_type).validate_json(
            content.data
        )


serializer = PydanticSerializer()


def make_lazy_value(val: str) -> LazyValue:
    async def async_iter():
        yield val.encode()

    return LazyValue(serializer=serializer, headers={}, stream=async_iter())
