/**
 * SPV (Simplified Payment Verification) Module
 *
 * Exports all SPV verification components for use in EdwinPAI Desktop.
 */

// BEEF Parser
export { parseBeef, serializeBeef } from './beef-parser';

// BUMP Parser
export {
  parseBump,
  serializeBump,
  parseBlockHeader,
  serializeBlockHeader,
  validateBlockHeaderPoW,
} from './bump-parser';

// Merkle Calculator
export {
  calculateMerkleRoot,
  verifyMerkleProof,
  verifyMerkleProofWithHeader,
  buildMerkleTree,
  generateMerkleProof,
  calculateTreeHeight,
  validateMerkleProofStructure,
  calculateConfirmations,
  estimateBlockPosition,
} from './merkle-calculator';

// SPV Verifier
export {
  SpvVerifier,
  verifyBeef,
  verifyBump,
  verifyBatch,
  type SpvVerificationOptions,
  type SpvVerificationResult,
} from './spv-verifier';
