import { StorageProvider, Source, Destination, Content } from ".";

class DavResource {
  path!: string;
  length!: number;
  collection!: boolean;
  last_modified?: number | null = null;
}
