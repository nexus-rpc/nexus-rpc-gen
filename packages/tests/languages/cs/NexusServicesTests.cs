
using System.Text;
using System.Text.Json;
using NexusRpc.Handlers;
using NexusServices;
using Xunit;

public class NexusServicesTests
{
    public static IOperationHandler<TInput, TResult> NotImplemented<TInput, TResult>() =>
        OperationHandler.Sync<TInput, TResult>(
            (_, _) => Task.FromException<TResult>(new NotImplementedException()));

    [NexusServiceHandler(typeof(IKitchenSinkService))]
    public class KitchenSinkService
    {
        [NexusOperationHandler]
        public IOperationHandler<string, long> ScalarArgScalarResult() =>
            OperationHandler.Sync<string, long>((ctx, input) => input.Length);

        [NexusOperationHandler]
        public IOperationHandler<
            KitchenSinkServiceComplexArgComplexResultInlineInput,
            KitchenSinkServiceComplexArgComplexResultInlineOutput> ComplexArgComplexResultInline() =>
            OperationHandler.Sync<
                KitchenSinkServiceComplexArgComplexResultInlineInput,
                KitchenSinkServiceComplexArgComplexResultInlineOutput>((ctx, input) =>
                    new() { CharacterCount = input.String.Length });

        [NexusOperationHandler]
        public IOperationHandler<string, long> ScalarArgScalarResultExternal() =>
            NotImplemented<string, long>();

        [NexusOperationHandler]
        public IOperationHandler<ComplexInput, ComplexOutput> ComplexArgComplexResultExternal() =>
            NotImplemented<ComplexInput, ComplexOutput>();
    }

    [Fact]
    public async Task KitchenSinkService_AsHandlers_Succeed()
    {
        // Just creating the handler validates the interface and class
        var handler = new Handler(
            [ServiceHandlerInstance.FromInstance(new KitchenSinkService())],
            NexusJsonSerializer.Instance);

        // We'll also test two method implementations
        var scalarResultContent = await handler.StartOperationAsync(
            context: new(
                Service: "KitchenSinkService",
                Operation: "scalarArgScalarResult",
                CancellationToken: default,
                RequestId: Guid.NewGuid().ToString()),
            input: new(Encoding.UTF8.GetBytes("\"some string\"")));
        var scalarResult = Convert.ToInt64(Encoding.UTF8.GetString(
            scalarResultContent.SyncResultValue!.ConsumeAllBytes()));
        Assert.Equal("some string".Length, scalarResult);

        var complexResultContent = await handler.StartOperationAsync(
            context: new(
                Service: "KitchenSinkService",
                Operation: "complexArgComplexResultInline",
                CancellationToken: default,
                RequestId: Guid.NewGuid().ToString()),
            input: new(Encoding.UTF8.GetBytes("{ \"string\": \"some other string\" }")));
        var complexResult = JsonSerializer.Deserialize<KitchenSinkServiceComplexArgComplexResultInlineOutput>(
            complexResultContent.SyncResultValue!.ConsumeAllBytes());
        Assert.Equal("some other string".Length, complexResult!.CharacterCount);
    }
}