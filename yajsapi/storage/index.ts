import { applyMixins } from "../utils";
const fs = require("fs");

const _BUF_SIZE = 40960;

export class Content {
  public length!: number;
  public stream!: any;

  constructor(length, stream) {
    this.length = length;
    this.stream = stream;
  }

  from_reader(length: number, s: any) {
    async function* stream(): AsyncGenerator<string> {
      for await (const chunk of s) {
        yield chunk;
      }
    }

    return new Content(length, stream());
  }
}

export class Source {
  download_url(): string {
    throw "NotImplementedError";
  }

  async content_length(): Promise<number> {
    throw "NotImplementedError";
  }
}

export class Destination {
  upload_url(): string {
    throw "NotImplementedError";
  }

  async download_stream(): Promise<Content> {
    throw "NotImplementedError";
  }

  async download_file(destination_file: string) {
    let content = await this.download_stream();
    var writableStream = fs.createWriteStream(destination_file, {
      encoding: "binary",
    });

    await new Promise(async (fulfill) => {
      writableStream.once("finish", fulfill);
      for await (let chunk of content.stream) {
        writableStream.write(chunk);
      }
      writableStream.end();
    });
  }
}

export class InputStorageProvider {
  async upload_stream(
    length: number,
    stream: AsyncGenerator<Buffer>
  ): Promise<Source> {
    throw "NotImplementedError";
  }

  async upload_bytes(data: Buffer): Promise<Source> {
    async function* _inner() {
      yield data;
    }

    return await this.upload_stream(data.length, _inner());
  }

  async upload_file(path: string): Promise<Source> {
    let file_size = fs.statSync(path)["size"];

    async function* read_file() {
      const stream = fs.createReadStream(path, {
        highWaterMark: _BUF_SIZE,
        encoding: "binary",
      });
      stream.once("end", () => {
        stream.destroy();
      })
      for await (let chunk of stream) {
        yield chunk;
      }
    }

    return await this.upload_stream(file_size, read_file());
  }
}

export class OutputStorageProvider {
  async new_destination(
    destination_file: string | null = null
  ): Promise<Destination> {
    /*
        Creates slot for receiving file.

        Parameters
        ----------
        destination_file:
            Optional hint where received data should be placed.

        */
    throw "NotImplementedError";
  }
}

export interface StorageProvider
  extends InputStorageProvider,
    OutputStorageProvider {}
export class StorageProvider {}

applyMixins(StorageProvider, [InputStorageProvider, OutputStorageProvider]);

export class ComposedStorageProvider implements StorageProvider {
  private _input;
  private _output;

  constructor(
    input_storage: InputStorageProvider,
    output_storage: OutputStorageProvider
  ) {
    this._input = input_storage;
    this._output = output_storage;
  }
  upload_bytes(data: Buffer): Promise<Source> {
    throw new Error("Method not implemented.");
  }

  async upload_stream(
    length: number,
    stream: AsyncGenerator<Buffer>
  ): Promise<Source> {
    return await this._input.upload_stream(length, stream);
  }

  async upload_file(path: string): Promise<Source> {
    return await this._input.upload_file(path);
  }

  async new_destination(
    destination_file: string | null = null
  ): Promise<Destination> {
    return await this._output.new_destination(destination_file);
  }
}
