import { code, Code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { Service } from './core';
import { TypeMap } from './types';
import { combineCode, createCodeGeneratorResponseFile, getMethodDefinition } from './utils';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import ServiceDescriptorProto = google.protobuf.ServiceDescriptorProto;

const GrpcMethod = imp('GrpcMethod@@nestjs/microservices');

function generateGrpcMethods({ name, method }: ServiceDescriptorProto): Code {
  if (method.length > 0) {
    return code`
          const grpcMethods: string[] = [${method.map(method => `'${method.name}'`).join(', ')}];
          for (const method of grpcMethods) {
            const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
            ${GrpcMethod}('${name}', method)(constructor.prototype[method], method, descriptor);
          }
        `;
  } else {
    return code``;
  }
}

function generateBackendService(serviceDescriptorProto: ServiceDescriptorProto, typeMap: TypeMap): Code {
  return code`
export interface ${serviceDescriptorProto.name}Controller {
  ${serviceDescriptorProto.method.map(method => getMethodDefinition(method, typeMap)).reduce(combineCode)}
}

export function ${serviceDescriptorProto.name}ControllerMethods() {
  return function (constructor: Function) {
    ${generateGrpcMethods(serviceDescriptorProto)}
  }
}`;
}

export async function generateBackendContent(service: Service, fileDescriptorProto: FileDescriptorProto, typeMap: TypeMap): Promise<CodeGeneratorResponse.File> {
  const code = fileDescriptorProto.service
    .map(serviceDescriptorProto => generateBackendService(serviceDescriptorProto, typeMap))
    .reduce(combineCode);
  return createCodeGeneratorResponseFile(service, fileDescriptorProto, 'backend', code);
}
