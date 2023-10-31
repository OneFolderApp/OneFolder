fn read_files() {
    for path in &["./monalisa.jpg"] {
        let file = std::fs::File::open(path).unwrap();
        let mut bufreader = std::io::BufReader::new(&file);
        let exifreader = exif::Reader::new();
        let exif = exifreader.read_from_container(&mut bufreader).unwrap();
        for f in exif.fields() {
            println!("{} {} {}", f.tag, f.ifd_num, f.display_value().with_unit(&exif));
        }
    }
}

fn main() {
    println!("Hello, world!");
    read_files();
}
