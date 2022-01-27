// Program wide Error alias.
pub type Result<T> = std::result::Result<T, CLIError>;

#[derive(Debug)]
pub struct CLIError(pub String);
