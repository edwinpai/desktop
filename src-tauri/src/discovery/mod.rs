// Gateway Discovery Module
//
// Provides mDNS-based service discovery for EdwinPAI gateways on local network.

pub mod mdns;
pub mod types;

pub use mdns::{MdnsService, DiscoveredGateway, init_mdns_service, get_mdns_service};
pub use types::{DiscoveredGatewayExtended, ContinuousScanConfig, ScanResult};
