use structopt::StructOpt;

#[derive(Debug, StructOpt)]
pub enum TerraCommand {
    #[structopt(about = "Initialize Terra Contract")]
    Initialize,

    #[structopt(about = "Dump current Token Bridge State")]
    Dump,
}
