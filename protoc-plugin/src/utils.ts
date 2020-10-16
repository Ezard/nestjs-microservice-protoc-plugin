import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { code, Code, imp } from 'ts-poet';
import { google } from 'ts-proto/build/pbjs';
import { Service } from './core';
import { getImpFromTypeName, TypeMap } from './types';
import CodeGeneratorResponse = google.protobuf.compiler.CodeGeneratorResponse;
import FileDescriptorProto = google.protobuf.FileDescriptorProto;
import MethodDescriptorProto = google.protobuf.MethodDescriptorProto;
import ReadableStream = NodeJS.ReadableStream;

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

export async function createCodeGeneratorResponseFile(
  service: Service,
  fileDescriptorProto: FileDescriptorProto,
  type: 'types' | 'backend' | 'frontend',
  code: Code,
): Promise<CodeGeneratorResponse.File> {
  const directory = fileDescriptorProto.package.replace('.', '/');
  const relativePath = `${directory}/${fileDescriptorProto.name
    .replace('protos/', '')
    .replace('.proto', '')}.${type}.ts`;
  const path = `${service.generatedDir}${relativePath}`;
  return new CodeGeneratorResponse.File({
    name: path,
    content: prefixDisableLinter(await code.toStringWithImports(relativePath.substr(0, relativePath.length - 3))),
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

export function mkdirs(path: string): void {
  if (!existsSync(path)) {
    mkdirs(join(path, '..'));
    mkdirSync(path);
  }
}

export function prefixDisableLinter(fileContents: string): string {
  return `/* eslint-disable */
${fileContents}`;
}
