import { join } from 'path';
import { util } from 'protobufjs';
import { code, Code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { Service } from './core';
import { getImpFromTypeName, TypeMap } from './types';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import MethodDescriptorProto = google.protobuf.MethodDescriptorProto;
import ReadableStream = NodeJS.ReadableStream;
import normalize = util.path.normalize;

const Observable = imp('Observable@rxjs');

export function readToBuffer(stream: ReadableStream): Promise<Buffer> {
  return new Promise(resolve => {
    const ret: Array<Buffer> = [];
    let len = 0;
    stream.on('data', (data: Buffer) => {
      ret.push(data);
      len += data.length;
    });
    stream.on('end', () => {
      resolve(Buffer.concat(ret, len));
    });
  });
}

function prefixDisableLinter(fileContents: string): string {
  return `/* eslint-disable */
${fileContents}`;
}

export async function createCodeGeneratorResponseFile(
  service: Service,
  fileDescriptorProto: FileDescriptorProto,
  type: 'types' | 'backend' | 'frontend',
  codeContent: Code,
): Promise<CodeGeneratorResponse.File> {
  const directory = fileDescriptorProto.package.replace('.', '/');
  const fileName = `${fileDescriptorProto.name.replace('.proto', '')}.${type}.ts`;
  const relativePath = normalize(join(directory, fileName));
  const fullPath = normalize(join(service.generatedDir, relativePath));
  return new CodeGeneratorResponse.File({
    name: fullPath,
    content: prefixDisableLinter(await codeContent.toStringWithImports(relativePath)),
  });
}

export async function createCodeGeneratorResponseFileForBackendMicroserviceOptions(
  service: Service,
  codeContent: Code,
): Promise<CodeGeneratorResponse.File> {
  const fullPath = normalize(join(service.generatedDir, 'backend-microservice-options.ts'));
  return new CodeGeneratorResponse.File({
    name: fullPath,
    content: prefixDisableLinter(await codeContent.toStringWithImports()),
  });
}

export function combineCode(acc: Code, cur: Code): Code {
  return code`${acc}\n${cur}`;
}

function getInputType(inputType: string, typeMap: TypeMap): Code {
  return getImpFromTypeName(typeMap, inputType);
}

function getNormalOutputType(outputType: string, typeMap: TypeMap): Code {
  return getImpFromTypeName(typeMap, outputType);
}

function getPromiseOutputType(outputType: string, typeMap: TypeMap): Code {
  return code`Promise<${getImpFromTypeName(typeMap, outputType)}>`;
}

function getObservableOutputType(outputType: string, typeMap: TypeMap): Code {
  return code`${Observable}<${getImpFromTypeName(typeMap, outputType)}>`;
}

function getOutputType(outputType: string, typeMap: TypeMap): Code {
  return code`${getNormalOutputType(outputType, typeMap)}
                | ${getPromiseOutputType(outputType, typeMap)}
                | ${getObservableOutputType(outputType, typeMap)}`;
}

export function getMethodDefinition({ name, inputType, outputType }: MethodDescriptorProto, typeMap: TypeMap): Code {
  return code`${name}(request: ${getInputType(inputType, typeMap)}): ${getOutputType(outputType, typeMap)}`;
}
