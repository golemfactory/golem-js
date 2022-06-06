interface StorageProvider {
  download(src: string, dst: string): Promise<boolean>;
  upload(src: string, dst: string): Promise<boolean>;
}
