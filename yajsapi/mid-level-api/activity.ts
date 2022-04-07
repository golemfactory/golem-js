import { Activity as ActivityApi } from "../rest";
import { Readable } from "stream";

interface Script {
    command: string;
    arguments: string[];
    environment: object;
}

export class Activity {
    public readonly id;

    constructor(private activity_api: ActivityApi) {
        
    }

    async executeOne(script: Script): Promise<Readable> {

    }

    async executeMany(scripts: Script[]): Promise<Readable> {

    }
}
