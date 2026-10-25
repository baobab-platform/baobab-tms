import type { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';
// First-party guard is deployed only through the pinned source patch tool.
// @ts-ignore Our published guard is source ESM until the native type port is qualified.
import { createCpNativeBinaryFence } from './cp-native-binary-fence.mjs';

/**
 * Native quarantine. A production-grade independently authenticated CP
 * execution-point verifier is NOT connected yet, so every I/O denies.
 * DO NOT replace with native JWT validation, orgId claim, or a caller flag.
 */
export function guardNativeBinary(raw: IBinaryStorageProvider): IBinaryStorageProvider {
  const guard=createCpNativeBinaryFence({raw,verifyCurrent:async()=>null});
  return guard.provider as IBinaryStorageProvider;
}
