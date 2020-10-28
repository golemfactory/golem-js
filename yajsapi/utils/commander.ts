import { program } from 'commander';
program.version('0.0.1');

program
  .option('-d, --debug', 'output extra debugging');

program.parse(process.argv);

export default program;
