/// Defines the state of the network connection.
pub enum ConnectionState {
    Connected,
    Disconnected,
}

/// A trait for objects that can send messages.
pub trait Sender {
    fn send(&self, msg: &str);
}

/// The main network client struct.
pub struct Client {
    id: u32,
}

/// Implementation block for the Client struct.
/// This acts as a parent for the functions inside.
impl Client {
    /// Creates a new Client instance.
    pub fn new() -> Self {
        Client { id: 1 }
    }
}

/// Global utility function to connect all clients.
pub fn connect_all() {
    // Standard comment, should be ignored by docstring extractor.
    println!("Connecting...");
}