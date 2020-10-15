import { copyFileSync } from 'fs';
import { join } from 'path';
import { Code, code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { Service } from './core';
import { TypeMap } from './types';
import { combineCode, createCodeGeneratorResponseFile, getMethodDefinition } from './utils';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import ServiceDescriptorProto = google.protobuf.ServiceDescriptorProto;

const ClientProviderOptions = imp('ClientProviderOptions@@nestjs/microservices/module/interfaces/clients-module.interface');
const Transport = imp('Transport@@nestjs/microservices');

function generateFrontendService(service: Service, srcProtosDir: string, fileDescriptorProto: FileDescriptorProto, serviceDescriptorProto: ServiceDescriptorProto, typeMap: TypeMap): Code {
  copyFileSync(join(srcProtosDir, fileDescriptorProto.name), join(service.protosDir, fileDescriptorProto.name));
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
        ${serviceDescriptorProto.method.map(method => getMethodDefinition(method, typeMap)).reduce(combineCode)}
      }
    `;
}

export async function generateFrontendContent(service: Service, protosDir: string, fileDescriptorProto: FileDescriptorProto, typeMap: TypeMap): Promise<CodeGeneratorResponse.File> {
  const code = fileDescriptorProto.service
    .map(serviceDescriptorProto => generateFrontendService(service, protosDir, fileDescriptorProto, serviceDescriptorProto, typeMap))
    .reduce(combineCode);
  return createCodeGeneratorResponseFile(service, fileDescriptorProto, 'frontend', code);
}
