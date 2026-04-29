// Channel Domain (SPEC §9)
//
// Manages channel integration wizards, credential encryption, and config persistence.

pub mod config;
pub mod encryption;
pub mod validation;

pub use config::{
    create_channel, delete_channel, list_channels, read_channel, read_channel_decrypted,
    update_channel, ChannelConfig, ChannelName, ChannelSettings, DecryptedChannelConfig,
};
pub use encryption::{decrypt_credentials, encrypt_credentials};
pub use validation::{validate_credentials, ValidationResult};
