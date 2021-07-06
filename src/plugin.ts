import { NestjsMicroservicePlugin } from './nestjs-microservice-plugin';

new NestjsMicroservicePlugin()
  .run()
  .then(() => {
    process.exit(0);
  })
  .catch(e => {
    process.stderr.write('FAILED');
    process.stderr.write(e.message);
    process.exit(1);
  });
