/// Program wide Error alias.
pub type Result<T> = std::result::Result<T, CLIError>;

/// assert!-like macro that returns errors instead of runtime panic.
#[macro_export]
macro_rules! require {
    ($e:expr, $err:expr) => {
        if !$e {
            return Err($err);
        }
    }
}

/// Errors captured from within the CLI application stack.
/// TODO: Capture more explicit errors with an enum and suberrors.
#[derive(Debug)]
pub struct CLIError(pub String);

/// Convenience cast from strings to CLIErrors.
impl From<&str> for CLIError {
    fn from(other: &str) -> CLIError {
        CLIError(other.to_string())
    }
}
