import type { RuntimeStrategy } from "@domain/settings";
import { LocalBridgeRuntimeProvider } from "@runtime/local-bridge-runtime";
import { PlaceholderRuntimeProvider } from "@runtime/placeholder-runtime";
import type { RuntimeProvider } from "@runtime/runtime-provider";

export function createRuntimeProvider(strategy: RuntimeStrategy): RuntimeProvider {
  if (strategy === "local_bridge") {
    return new LocalBridgeRuntimeProvider();
  }
  return new PlaceholderRuntimeProvider();
}
