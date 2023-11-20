// tracing.ts
import { HoneycombSDK } from "@honeycombio/opentelemetry-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { NodeSDK } from "@opentelemetry/sdk-node"

// Uses environment variables named HONEYCOMB_API_KEY and OTEL_SERVICE_NAME
const sdk: NodeSDK = new HoneycombSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      // We recommend disabling fs automatic instrumentation because
      // it can be noisy and expensive during startup
      "@opentelemetry/instrumentation-fs": {
        enabled: false 
      },
    }),
  ],
})

sdk.start()
// this needs to be at the bottom, so we bootstrap telemetry before evaluating index
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import "./index"
