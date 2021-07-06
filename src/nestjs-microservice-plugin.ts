import { CodeGeneratorRequest, GeneratedFile, PluginBase } from '@protobuf-ts/plugin-framework';
import { generateFiles } from './core';

export class NestjsMicroservicePlugin extends PluginBase<GeneratedFile> {
  async generate(request: CodeGeneratorRequest): Promise<GeneratedFile[]> {
    const args = request.parameter?.split(',');

    const servicesFile = args?.find(arg => /services_file=./.test(arg))?.split('=')[1];
    if (!servicesFile) {
      throw new Error('"services_file" parameter must be specified e.g. --ts_proto_opt=services_file=services.json');
    }

    const protosDir = args?.find(arg => /protos_dir=./.test(arg))?.split('=')[1];
    if (!protosDir) {
      throw new Error('"protos_dir" parameter must be specified e.g. --ts_proto_opt=protos_dir=../protos');
    }

    return generateFiles(request.protoFile, servicesFile, protosDir);
  }
}
