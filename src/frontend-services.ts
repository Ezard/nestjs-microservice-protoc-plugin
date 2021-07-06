import { FileDescriptorProto, GeneratedFile, ServiceDescriptorProto } from '@protobuf-ts/plugin-framework';
import { copyFileSync } from 'fs';
import { join } from 'path';
import { Code, code, imp } from 'ts-poet';
import { Service } from './core';
import { TypeMap } from './types';
import { assertDefined, combineCode, createGeneratedFile, getMethodDefinition } from './utils';

const ClientProviderOptions = imp('ClientProviderOptions@@nestjs/microservices');
const Transport = imp('Transport@@nestjs/microservices');

function generateFrontendService(
  service: Service,
  srcProtosDir: string,
  fileDescriptorProto: FileDescriptorProto,
  serviceDescriptorProto: ServiceDescriptorProto,
  typeMap: TypeMap,
): Code {
  assertDefined(fileDescriptorProto.name);
  copyFileSync(join(srcProtosDir, fileDescriptorProto.name), join(service.protosDir, fileDescriptorProto.name));
  const methodDefinitions = serviceDescriptorProto.method
    .map(method => getMethodDefinition(method, typeMap))
    .reduce(combineCode, code``);
  return code`
    export const ${serviceDescriptorProto.name}ClientProviderOptions: ${ClientProviderOptions} = {
      name: '${serviceDescriptorProto.name}',
      transport: ${Transport}.GRPC,
      options: {
        package: '${fileDescriptorProto.package}',
        protoPath: '../protos/${fileDescriptorProto.name}'
      }
    };

    export interface ${serviceDescriptorProto.name}Client {
      ${methodDefinitions}
    }
  `;
}

export async function generateFrontendContent(
  service: Service,
  protosDir: string,
  fileDescriptorProto: FileDescriptorProto,
  typeMap: TypeMap,
): Promise<GeneratedFile> {
  const codeContent = fileDescriptorProto.service
    .map(serviceDescriptorProto =>
      generateFrontendService(service, protosDir, fileDescriptorProto, serviceDescriptorProto, typeMap),
    )
    .reduce(combineCode, code``);
  return createGeneratedFile(service, fileDescriptorProto, 'frontend', codeContent);
}
