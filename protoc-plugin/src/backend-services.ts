import { copyFileSync } from 'fs';
import { join } from 'path';
import { util } from 'protobufjs';
import { code, Code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { determineServices, Service, Services } from './core';
import { TypeMap } from './types';
import {
  combineCode,
  createCodeGeneratorResponseFile,
  createCodeGeneratorResponseFileForBackendMicroserviceOptions,
  getMethodDefinition,
} from './utils';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import ServiceDescriptorProto = google.protobuf.ServiceDescriptorProto;
import normalize = util.path.normalize;

const GrpcMethod = imp('GrpcMethod@@nestjs/microservices');
const GrpcOptions = imp('GrpcOptions@@nestjs/microservices');
const Transport = imp('Transport@@nestjs/microservices');

function generateGrpcMethods({ name, method: methods }: ServiceDescriptorProto): Code {
  if (methods.length > 0) {
    const methodNames = methods.map(method => `'${method.name}'`).join(', ');
    return code`
      const grpcMethods: string[] = [${methodNames}];
      for (const method of grpcMethods) {
        const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
        ${GrpcMethod}('${name}', method)(constructor.prototype[method], method, descriptor);
      }
    `;
  } else {
    return code``;
  }
}

function generateBackendService(
  service: Service,
  srcProtosDir: string,
  fileDescriptorProto: FileDescriptorProto,
  serviceDescriptorProto: ServiceDescriptorProto,
  typeMap: TypeMap,
): Code {
  copyFileSync(join(srcProtosDir, fileDescriptorProto.name), join(service.protosDir, fileDescriptorProto.name));
  const methodDefinitions = serviceDescriptorProto.method
    .map(method => getMethodDefinition(method, typeMap))
    .reduce(combineCode, code``);
  return code`
    export interface ${serviceDescriptorProto.name}Controller {
      ${methodDefinitions}
    }

    export function ${serviceDescriptorProto.name}ControllerMethods() {
      return function (constructor: Function) {
        ${generateGrpcMethods(serviceDescriptorProto)}
      }
    }
  `;
}

export async function generateBackendContent(
  service: Service,
  protosDir: string,
  fileDescriptorProto: FileDescriptorProto,
  typeMap: TypeMap,
): Promise<CodeGeneratorResponse.File> {
  const codeContent = fileDescriptorProto.service
    .map(serviceDescriptorProto =>
      generateBackendService(service, protosDir, fileDescriptorProto, serviceDescriptorProto, typeMap),
    )
    .reduce(combineCode, code``);
  return createCodeGeneratorResponseFile(service, fileDescriptorProto, 'backend', codeContent);
}

export function generateBackendMicroserviceOptionsFiles(
  services: Services,
  fileDescriptorProtoList: FileDescriptorProto[],
): Promise<google.protobuf.compiler.CodeGeneratorResponse.File>[] {
  return fileDescriptorProtoList
    .flatMap(fileDescriptorProto => ({
      fileDescriptorProto,
      backendServices: determineServices(services, fileDescriptorProto).backendServices,
    }))
    .flatMap(({ backendServices, fileDescriptorProto }) =>
      backendServices.map(backendService => ({ backendService, fileDescriptorProto })),
    )
    .reduce((acc, { backendService, fileDescriptorProto }) => {
      const item = acc.find(value => value.service === backendService);
      if (item) {
        item.fileDescriptorProtos.push(fileDescriptorProto);
      } else {
        acc.push({ service: backendService, fileDescriptorProtos: [fileDescriptorProto] });
      }
      return acc;
    }, [] as { service: Service; fileDescriptorProtos: FileDescriptorProto[] }[])
    .flatMap(({ service, fileDescriptorProtos }) => {
      const packages = fileDescriptorProtos
        .map(fileDescriptorProto => `'${normalize(fileDescriptorProto.package.replace('.', '/'))}'`)
        .filter((value, index, array) => array.indexOf(value) === index)
        .join(',');
      const protoPaths = fileDescriptorProtos
        .map(fileDescriptorProto => `'${normalize(`../protos/${fileDescriptorProto.name}`)}'`)
        .join(',');
      const codeContent = code`
        export function getBackendMicroserviceOptions(url: string): ${GrpcOptions} {
          return {
            transport: ${Transport}.GRPC,
            options: {
              package: [${packages}],
              protoPath: [${protoPaths}],
              url,
            },
          };
        }
      `;
      return createCodeGeneratorResponseFileForBackendMicroserviceOptions(service, codeContent);
    });
}
