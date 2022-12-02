import {spawn} from "child_process";

export class Goth {
    async run() {
        return new Promise((resolve, reject) => {
            let log = '';
            const result = spawn("python -m goth start ../assets/goth-config.yml", { encoding: "utf8" });

            result.stdout.on('data', (data) => {
                console.log(data);
            });

            result.stderr.on('data', reject);

            result.on('close', () => {
                console.log('Goth process exit');
            });
        })
    }
    async end() {

    }
}