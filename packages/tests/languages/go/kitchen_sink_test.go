package main_test

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/nexus-rpc-gen/packages/tests/languages/go/services"
	"github.com/nexus-rpc/sdk-go/nexus"
	"github.com/stretchr/testify/require"
)

type KitchenSinkService struct{}

func (KitchenSinkService) ScalarArgScalarResult(
	ctx context.Context,
	input services.KitchenSinkServiceScalarArgScalarResultInput,
	options nexus.StartOperationOptions,
) (services.KitchenSinkServiceScalarArgScalarResultOutput, error) {
	return services.KitchenSinkServiceScalarArgScalarResultOutput(len(input)), nil
}

func (KitchenSinkService) ComplexArgComplexResultInline(
	ctx context.Context,
	input services.KitchenSinkServiceComplexArgComplexResultInlineInput,
	options nexus.StartOperationOptions,
) (services.KitchenSinkServiceComplexArgComplexResultInlineOutput, error) {
	count := int64(len(input.String))
	return services.KitchenSinkServiceComplexArgComplexResultInlineOutput{CharacterCount: count}, nil
}

func (k KitchenSinkService) BuildNexusService() *nexus.Service {
	ret := nexus.NewService(services.KitchenSinkService.ServiceName)
	ret.MustRegister(nexus.NewSyncOperation(
		services.KitchenSinkService.ScalarArgScalarResult.Name(),
		k.ScalarArgScalarResult))
	ret.MustRegister(nexus.NewSyncOperation(
		services.KitchenSinkService.ComplexArgComplexResultInline.Name(),
		k.ComplexArgComplexResultInline))
	return ret
}

func TestKitchenSink(t *testing.T) {
	// Build handler, which validates proper operations
	reg := nexus.NewServiceRegistry()
	reg.MustRegister(KitchenSinkService{}.BuildNexusService())
	handler, err := reg.NewHandler()
	require.NoError(t, err)

	// Also, check two implementations work as expected

	scalarResult, err := handler.StartOperation(
		// TODO(cretz): Panics if not WithHandlerContext not used, discussing
		// why internally
		nexus.WithHandlerContext(t.Context(), nexus.HandlerInfo{
			Service: "KitchenSinkService", Operation: "scalarArgScalarResult",
		}),
		"KitchenSinkService", "scalarArgScalarResult",
		nexus.NewLazyValue(
			nexus.DefaultSerializer(),
			&nexus.Reader{
				ReadCloser: io.NopCloser(strings.NewReader(`"some string"`)),
				Header:     map[string]string{"type": "application/json"},
			}),
		nexus.StartOperationOptions{})
	require.NoError(t, err)
	scalarResultSync :=
		scalarResult.(*nexus.HandlerStartOperationResultSync[services.KitchenSinkServiceScalarArgScalarResultOutput])
	require.Equal(t, services.KitchenSinkServiceScalarArgScalarResultOutput(11), scalarResultSync.Value)

	complexResult, err := handler.StartOperation(
		// TODO(cretz): Panics if not WithHandlerContext not used, discussing
		// why internally
		nexus.WithHandlerContext(t.Context(), nexus.HandlerInfo{
			Service: "KitchenSinkService", Operation: "complexArgComplexResultInline",
		}),
		"KitchenSinkService", "complexArgComplexResultInline",
		nexus.NewLazyValue(
			nexus.DefaultSerializer(),
			&nexus.Reader{
				ReadCloser: io.NopCloser(strings.NewReader(`{ "string": "some other string" }`)),
				Header:     map[string]string{"type": "application/json"},
			}),
		nexus.StartOperationOptions{})
	require.NoError(t, err)
	complexResultSync :=
		complexResult.(*nexus.HandlerStartOperationResultSync[services.KitchenSinkServiceComplexArgComplexResultInlineOutput])
	require.Equal(t, int64(17), complexResultSync.Value.CharacterCount)
}
