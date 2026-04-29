/**
 * Identity Setup UI type definitions (Phase 1)
 *
 * Types for the identity setup wizard and related components.
 */

// --- Identity Setup Steps ---

export enum IdentitySetupStep {
  /** Welcome/intro screen */
  Welcome = "welcome",
  /** Generate or import identity key */
  GenerateKey = "generate_key",
  /** Display generated identity (petname, avatar, public key) */
  ReviewIdentity = "review_identity",
  /** Set up backup/recovery phrase */
  BackupKey = "backup_key",
  /** Confirm backup by re-entering recovery phrase */
  ConfirmBackup = "confirm_backup",
  /** Setup complete */
  Complete = "complete",
}

// --- Component Props ---

export interface IdentitySetupProps {
  /** Callback when setup is complete */
  onComplete: (identity: SetupIdentity) => void;
  /** Callback when setup is cancelled */
  onCancel?: () => void;
  /** Initial step (default: Welcome) */
  initialStep?: IdentitySetupStep;
  /** Whether to allow skipping backup (not recommended) */
  allowSkipBackup?: boolean;
}

export interface IdentitySetupStepProps {
  /** Current identity being set up */
  identity: SetupIdentity | null;
  /** Callback to move to next step */
  onNext: (identity: SetupIdentity) => void;
  /** Callback to go back to previous step */
  onBack?: () => void;
  /** Callback to cancel setup */
  onCancel?: () => void;
}

// --- Setup Identity State ---

export interface SetupIdentity {
  /** Compressed public key (hex-encoded) */
  publicKey: string;
  /** Deterministic petname */
  petname: string;
  /** SVG identicon */
  avatarSvg: string;
  /** Short ID (e.g., "edw:a3f7b2c1") */
  shortId: string;
  /** BIP-39 recovery phrase (12 words) */
  recoveryPhrase?: string[];
  /** Whether backup has been confirmed */
  backupConfirmed: boolean;
}

// --- Individual Step Component Props ---

export interface WelcomeStepProps {
  onNext: () => void;
  onCancel?: () => void;
}

export interface GenerateKeyStepProps {
  onNext: (identity: SetupIdentity) => void;
  onBack: () => void;
  onCancel?: () => void;
  /** Whether key generation is in progress */
  isGenerating?: boolean;
}

export interface ReviewIdentityStepProps {
  identity: SetupIdentity;
  onNext: () => void;
  onBack: () => void;
  onCancel?: () => void;
}

export interface BackupKeyStepProps {
  identity: SetupIdentity;
  onNext: () => void;
  onBack: () => void;
  onCancel?: () => void;
  /** Whether to allow skipping backup */
  allowSkip?: boolean;
}

export interface ConfirmBackupStepProps {
  identity: SetupIdentity;
  onNext: () => void;
  onBack: () => void;
  onCancel?: () => void;
}

export interface CompleteStepProps {
  identity: SetupIdentity;
  onComplete: () => void;
}

// --- Identity Display Props ---

export interface IdentityCardProps {
  /** Public key (hex-encoded) */
  publicKey: string;
  /** Petname */
  petname: string;
  /** Avatar SVG */
  avatarSvg: string;
  /** Short ID */
  shortId: string;
  /** Whether to show full public key (default: false) */
  showFullKey?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface IdenticonProps {
  /** Public key to generate identicon from */
  publicKey: string;
  /** Size in pixels (default: 64) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

export interface PetnameDisplayProps {
  /** Petname to display */
  petname: string;
  /** Additional CSS classes */
  className?: string;
}

// --- Recovery Phrase Props ---

export interface RecoveryPhraseDisplayProps {
  /** BIP-39 recovery phrase (12 words) */
  words: string[];
  /** Whether to obscure the words (for testing backup) */
  obscured?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface RecoveryPhraseInputProps {
  /** Expected recovery phrase for validation */
  expectedWords: string[];
  /** Callback when validation succeeds */
  onValidate: (valid: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

// --- Key Import Props ---

export interface ImportKeyProps {
  /** Callback when key is imported */
  onImport: (identity: SetupIdentity) => void;
  /** Callback to cancel import */
  onCancel: () => void;
}

export interface ImportKeyFormProps {
  /** Recovery phrase input */
  recoveryPhrase: string;
  /** Callback when recovery phrase changes */
  onRecoveryPhraseChange: (phrase: string) => void;
  /** Callback when import is submitted */
  onSubmit: () => void;
  /** Whether import is in progress */
  isImporting?: boolean;
  /** Validation error message */
  error?: string;
}
